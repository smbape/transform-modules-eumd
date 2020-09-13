import { declare } from "@babel/helper-plugin-utils";
import { basename, extname } from "path";
import {
  isModule,
  rewriteModuleStatementsAndPrepareHeader,
  isSideEffectImport,
  buildNamespaceInitStatements,
  ensureStatementsHoisted,
  wrapInterop,
} from "@babel/helper-module-transforms";
import { types as t, template } from "@babel/core";

import _getOpts from "./_getOpts";
import _resolveNameArg from "./_resolveNameArg";
import _parseDependency from "./_parseDependency";
import resolveName from "./_resolveName";

const buildPrerequisiteAssignment = template(`
  GLOBAL_REFERENCE = GLOBAL_REFERENCE || {}
`);

const globalFactory = `
function(_this) {
  var g;
  if (typeof window !== "undefined") {
    g = window;
  } else if (typeof global !== "undefined") {
    g = global;
  } else if (typeof self !== "undefined") {
    g = self;
  } else {
    g = _this;
  }
  return g;
  // eslint-disable-next-line no-invalid-this
}
`.trim();

const buildWithoutRequireWrapper = template(`
  (function (global, factory) {
    if (typeof define === "function" && define.amd) {
      define(MODULE_NAME, AMD_DEPENDENCIES, function() {
        return factory.apply(global, AMD_ARGUMENTS);
      });
    } else if (typeof exports === "object" && typeof module !== "undefined") {
      if (typeof process === "object" && typeof process.platform !== "undefined") {
        factory.call(global, NODE_ARGUMENTS);
      } else if (global.require && global.require.brunch) {
        factory.call(global, BRUNCH_ARGUMENTS);
      } else {
        factory.call(global, COMMONJS_ARGUMENTS);
      }
    } else {
      var mod = { exports: {} };
      factory(BROWSER_ARGUMENTS);

      GLOBAL_TO_ASSIGN;
    }
  })((${ globalFactory })(this), function(IMPORT_NAMES) {
  })
`, { placeholderPattern: /^[A-Z][_A-Z0-9]+$/, preserveComments: true });

const buildWithRequireWrapper = params => {
  const vars = Object.assign({}, params);
  delete vars.UMD_LOADER;

  return template(`
    (function (global, factory, _require, umdLoader) {
      var require;

      if (typeof define === "function" && define.amd) {
        define(MODULE_NAME, AMD_DEPENDENCIES, function() {
          var args = AMD_ARGUMENTS;
          args[0] = umdLoader.amd(args[0], global);
          return factory.apply(global, args);
        });
      } else if (typeof exports === "object" && typeof module !== "undefined") {
        if (typeof process === "object" && typeof process.platform !== "undefined") {
          require = umdLoader.common(_require, global, "node");
          factory.call(global, NODE_ARGUMENTS);
        } else if (global.require && global.require.brunch) {
          require = umdLoader.common(_require, global, ["brunch", "common"]);
          factory.call(global, BRUNCH_ARGUMENTS);
        } else {
          require = umdLoader.common(_require, global, "common");
          factory.call(global, COMMONJS_ARGUMENTS);
        }
      } else {
        var mod = { exports: {} };
        factory(BROWSER_ARGUMENTS);

        GLOBAL_TO_ASSIGN;
      }
    })((${ globalFactory })(this), function(IMPORT_NAMES) {
    }, typeof require === "undefined" ? undefined : require, ${ params.UMD_LOADER });
  `, { placeholderPattern: /^[A-Z][_A-Z0-9]+$/, preserveComments: true})(vars);
};

const umdLoaderFactory = `
function umdLoaderFactory() {
  var objectToString = Object.prototype.toString;
  var objectTag = "[object Object]";
  var hasProp = Object.prototype.hasOwnProperty;
  var funcToString = Function.prototype.toString;
  var objectCtorString = funcToString.call(Object);

  function isObjectLike(value) {
    return typeof value === "object" && value !== null;
  }

  function isPlainObject(value) {
    if (!isObjectLike(value) || objectToString.call(value) !== objectTag) {
      return false;
    }

    var proto = Object.getPrototypeOf(value);
    if (proto === null) {
      return true;
    }

    var Ctor = hasProp.call(proto, "constructor") && proto.constructor;
    return "function" === typeof Ctor && Ctor instanceof Ctor && funcToString.call(Ctor) === objectCtorString;
  }

  RESOLVE_NAME

  function _processCommonDep(require, type, dep, _global, libs, errors, _interpolate) {
    if (dep == null) {
      libs.push(undefined);
      return;
    }

    var ex;

    switch (dep[0]) {
      case "!":
        // global depency requested
        if (typeof _global !== "object") {
          throw new Error("global scope is not an object");
        }

        libs.push(_global[dep.slice(1)]);
        break;

      case "$":
        // Ignore dependency. To use with angular as an example
        libs.push(undefined);
        break;

      default:
        if (_interpolate !== false && dep[0] === "%" && dep[1] === "{" && dep[dep.length - 1] === "}") {
          dep = (new Function("return " + dep.slice(1)))(); // eslint-disable-line no-new-func
          _processCommonDep(require, type, dep, _global, libs, errors);
          return;
        }

        dep = resolveName(dep);
        if (errors) {
          try {
            libs.push(require(dep));
          } catch ( error ) {
            ex = error;
            if (typeof errback !== "function") {
              throw ex;
            }
            errors.push(ex);
          }
        } else {
          libs.push(require(dep));
        }
    }
  }

  function _commonRequireDeps(require, type, deps, _global, libs, errors) {
    deps.forEach(function(dep) {
      var found;

      if (isObjectLike(dep)) {
        if (Array.isArray(type)) {
          found = null;
          type.some(function(name) {
            if (hasProp.call(dep, name)) {
              found = dep[name];
              return true;
            }

            return false;
          });
          dep = found;
        } else {
          dep = dep[type];
        }
      }

      _processCommonDep(require, type, dep, _global, libs, errors);
    });

    return libs;
  }

  // eslint-disable-next-line consistent-return
  function commonSpecRequire(require, type, deps, callback, errback, options, _global) {
    if (typeof deps === "string" || isPlainObject(deps)) {
      deps = [deps];
    } else if (typeof deps === "undefined") {
      deps = [];
    }

    var libs = [];
    var errors = [];

    _commonRequireDeps(require, type, deps, _global, libs, errors);

    if (errors.length !== 0) {
      return errback.apply(_global, errors);
    }

    if (typeof callback === "function") {
      return callback.apply(_global, libs);
    }

    if (deps.length === 1) {
      return libs[0];
    }

    return undefined;
  }

  function localCommonRequire(require, _global, type) {
    return function localRequire(deps, callback, errback, options) {
      return commonSpecRequire(require, type, deps, callback, errback, options, _global);
    };
  }

  function _processAmdDep(_global, libs, availables, map, dep, index, _interpolate) {
    if (dep == null) {
      availables[index] = undefined;
      return;
    }

    switch (dep[0]) {
      case "!":
        // global depency requested
        if (typeof _global !== "object") {
          throw new Error("global scope is not an object");
        }
        availables[index] = _global[dep.slice(1)];
        break;

      case "$":
        // Ignore dependency. To use with angular as an example
        availables[index] = undefined;
        break;

      default:
        if (_interpolate !== false && dep[0] === "%" && dep[1] === "{" && dep[dep.length - 1] === "}") {
          dep = (new Function("return " + dep.slice(1)))(); // eslint-disable-line no-new-func
          _processAmdDep(_global, libs, availables, map, dep, index, false)
          return;
        }

        map[libs.length] = index;
        dep = resolveName(dep);
        libs.push(dep);
    }
  }

  // eslint-disable-next-line consistent-return
  function amdRequire(require, deps, callback, errback, options, _global) {
    if (typeof deps === "string" || isPlainObject(deps)) {
      deps = [deps];
    } else if (typeof deps === "undefined") {
      deps = [];
    }

    var libs = [];
    var availables = [];
    var map = {};

    deps.forEach(function(dependency, index) {
      if (typeof dependency === "string") {
        _processAmdDep(_global, libs, availables, map, dependency, index);
      } else if (isObjectLike(dependency)) {
        _processAmdDep(_global, libs, availables, map, dependency.amd, index);
      }
    });

    if (typeof callback !== "function" && deps.length === 1) {
      return availables.length === 0 ? require(libs[0]) : availables[0];
    }

    if (libs.length === 0) {
      return callback.apply(_global, availables);
    }

    require(libs, function() {
      var lib;

      for (var index = 0, len = arguments.length; index < len; index++) {
        lib = arguments[index];
        availables[map[index]] = lib;
      }

      return callback.apply(_global, availables);
    }, errback);

    return undefined;
  }

  function localAmdRequire(require, _global) {
    return function localRequire(deps, callback, errback, options) {
      return amdRequire(require, deps, callback, errback, options, _global);
    };
  }

  return {
    amd: localAmdRequire,
    common: localCommonRequire
  };
}
`.trim();

const globalMemberExpression = node => {
  const evaluated = /(?:^\d|\W)/.test(node.name);
  return t.memberExpression(t.identifier("global"), evaluated ? t.stringLiteral(node.name) : node, evaluated);
};

export default declare((api, options) => {
  api.assertVersion(7); // eslint-disable-line no-magic-numbers

  /**
   * Build the assignment statements that initialize the UMD global.
   */
  function buildBrowserInit(
    browserGlobals,
    exactGlobals,
    filename,
    moduleName,
  ) {
    const moduleNameOrBasename = moduleName
      ? moduleName.value
      : basename(filename, extname(filename));
    let globalToAssign = t.memberExpression(
      t.identifier("global"),
      t.identifier(t.toIdentifier(moduleNameOrBasename)),
    );
    let initAssignments = [];

    if (exactGlobals) {
      const globalName = browserGlobals[moduleNameOrBasename];

      if (globalName) {
        initAssignments = [];

        const members = globalName.split(".");
        globalToAssign = members.slice(1).reduce((accum, curr) => {
          initAssignments.push(
            buildPrerequisiteAssignment({
              GLOBAL_REFERENCE: t.cloneNode(accum),
            }),
          );
          return t.memberExpression(accum, t.identifier(curr));
        }, t.memberExpression(t.identifier("global"), t.identifier(members[0])));
      }
    }

    initAssignments.push(
      t.expressionStatement(
        t.assignmentExpression(
          "=",
          globalToAssign,
          t.memberExpression(t.identifier("mod"), t.identifier("exports")),
        ),
      ),
    );

    return initAssignments;
  }

  const isRequireCall = path => {
    if (!path.isCallExpression()) {
      return false;
    }

    if (!path.get("callee").isIdentifier({
        name: "require"
      })) {
      return false;
    }

    return !path.scope.getBinding("require");
  };

  const ReferenceVisitor = {
    ReferencedIdentifier({node, scope}) {
      if (node.name === "module" && !scope.getBinding("module")) {
        this.hasModule = true;
      }
      if (node.name === "exports" && !scope.getBinding("exports")) {
        this.hasExports = true;
      }
    },

    CallExpression(path) {
      if (!isRequireCall(path)) {
        return;
      }

      this.hasRequire = true;
    },

    VariableDeclarator(path) {
      const id = path.get("id");
      if (!id.isIdentifier()) {
        return;
      }

      const init = path.get("init");

      if (!isRequireCall(init)) {
        return;
      }

      this.hasRequire = true;
    }
  };

  return {
    name: "transform-modules-eumd",

    visitor: {
      Program: {
        exit(path, state) {
          if (!isModule(path)) {
            return;
          }

          const opts = Object.assign({}, options, _getOpts(path, state));

          if (opts.disabled || opts.explicitExtendedUmd && !opts.__inline) {
            return;
          }

          const {scope} = path;

          // In order to determine which global commonjs variables are referenced,
          // rename those commonjs variables if they're declared in the top scope.
          scope.rename("module");
          scope.rename("exports");
          scope.rename("require");

          const hasImports = path.get("body").some(child => child.isImportDeclaration());
          this.hasExports = path.get("body").some(child => child.isExportDeclaration());
          path.traverse(ReferenceVisitor, this);

          if (opts.esmOnly && !this.hasExports && !hasImports) {
            return;
          }

          const {globals, exactGlobals, loose, allowTopLevelThis, strict, strictMode, noInterop } = opts;
          const browserGlobals = globals || {};

          let moduleName = this.getModuleName();
          if (moduleName) {
            moduleName = t.stringLiteral(moduleName);
          }

          const addModuleExports = opts.addModuleExports && path.get("body").some(child => child.isExportDefaultDeclaration());

          const {meta, headers} = rewriteModuleStatementsAndPrepareHeader(path, {
            loose,
            strict,
            strictMode,
            allowTopLevelThis,
            noInterop,
            exportName: "exports"
          });

          if (addModuleExports) {
            this.hasModule = true;
            path.pushContainer("body", [template(`module.exports = ${ meta.exportName }.default`)()]);
            if (opts.addDefaultProperty) {
              path.pushContainer("body", [template(`module.exports.default = ${ meta.exportName }.default`)()]);
            }
          }

          const amdDeps = [];
          const amdArgs = [];
          const brunchArgs = [];
          const commonjsArgs = [];
          const nodeArgs = [];
          const browserArgs = [];
          const importNames = [];

          const _resolveName = opts.resolveName || resolveName;

          const buildAmdArg = arg => {
            if (arg.type === "StringLiteral" && arg.value[0] === "!") {
              arg = globalMemberExpression(t.identifier(arg.value.slice(1)));
            }

            if (arg.type === "StringLiteral") {
              amdArgs.push(t.memberExpression(t.identifier("arguments"), t.numericLiteral(amdDeps.length), true));
              amdDeps.push(arg);
            } else {
              amdArgs.push(arg);
            }
          };

          const buildCommonJsArg = (name, arg) => {
            if (arg === false) {
              switch (name) {
                case "brunch":
                  brunchArgs.pop();
                  break;
                case "common":
                  commonjsArgs.pop();
                  break;
                case "node":
                  nodeArgs.pop();
                  break;
                default:
                  throw new Error(`Unknown environment ${ name }'`);
              }
              return;
            }

            switch (arg.value) {
              case "exports":
              case "module":
              case "require":
                arg = t.identifier(arg.value);
                break;
              default:
                if (arg.type === "Identifier" && arg.name === "undefined") {
                  arg = t.identifier(arg.name);
                  break;
                }
                if (arg.value[0] === "!") {
                  arg = globalMemberExpression(t.identifier(arg.value.slice(1)));
                } else {
                  arg = t.callExpression(t.identifier("require"), [arg]);
                }
            }

            switch (name) {
              case "brunch":
                brunchArgs.push(arg);
                break;
              case "common":
                commonjsArgs.push(arg);
                break;
              case "node":
                nodeArgs.push(arg);
                break;
              default:
                throw new Error(`Unknown environment ${ name }'`);
            }
          };

          const buildBrowserArg = arg => {
            if (arg.type === "Identifier") {
              // Do nothing
            } else if (arg.value === "module") {
              arg = t.identifier("mod");
            } else if (arg.value === "exports") {
              arg = t.memberExpression(t.identifier("mod"), t.identifier("exports"));
            } else if (arg.value[0] === "!") {
              arg = globalMemberExpression(t.identifier(arg.value.slice(1)));
            } else {
              let memberExpression;

              if (exactGlobals) {
                const globalRef = browserGlobals[arg.value];
                if (globalRef) {
                  memberExpression = globalRef
                    .split(".")
                    .reduce(
                      ( accum, curr) => t.memberExpression(accum, t.identifier(curr)),
                      t.identifier("global")
                    );
                } else {
                  memberExpression = globalMemberExpression(t.identifier(t.toIdentifier(arg.value)));
                }
              } else {
                const requireName = basename(arg.value, extname(arg.value));
                const globalName = browserGlobals[requireName] || requireName;
                memberExpression = globalMemberExpression(t.identifier(t.toIdentifier(globalName)));
              }

              arg = memberExpression;
            }

            browserArgs.push(arg);
          };

          if (this.hasRequire) {
            const arg = t.stringLiteral("require");
            buildAmdArg(arg);
            buildBrowserArg(arg);
            buildCommonJsArg("brunch", arg);
            buildCommonJsArg("common", arg);
            buildCommonJsArg("node", arg);
            importNames.push(t.identifier("require"));
          }

          if (this.hasModule) {
            const arg = t.stringLiteral("module");
            buildAmdArg(arg);
            buildBrowserArg(arg);
            buildCommonJsArg("brunch", arg);
            buildCommonJsArg("common", arg);
            buildCommonJsArg("node", arg);
            importNames.push(t.identifier("module"));
          }

          if (this.hasExports) {
            const arg = t.stringLiteral("exports");
            buildAmdArg(arg);
            buildBrowserArg(arg);
            buildCommonJsArg("brunch", arg);
            buildCommonJsArg("common", arg);
            buildCommonJsArg("node", arg);
            importNames.push(t.identifier(meta.exportName));
          }

          for (const [source, metadata] of meta.source) {
            if (!_parseDependency(this, t, source, metadata, buildAmdArg, buildBrowserArg, buildCommonJsArg, _resolveName, opts)) {
              const arg = _resolveNameArg(_resolveName, t.stringLiteral(source));
              buildAmdArg(arg);
              buildBrowserArg(arg);
              buildCommonJsArg("brunch", arg);
              buildCommonJsArg("common", arg);
              buildCommonJsArg("node", arg);
            }
            importNames.push(t.identifier(metadata.name));

            if (!isSideEffectImport(metadata)) {
              const interop = wrapInterop(
                path,
                t.identifier(metadata.name),
                metadata.interop,
              );
              if (interop) {
                const header = t.expressionStatement(
                  t.assignmentExpression(
                    "=",
                    t.identifier(metadata.name),
                    interop,
                  ),
                );
                header.loc = meta.loc;
                headers.push(header);
              }
            }

            headers.push(
              ...buildNamespaceInitStatements(meta, metadata, loose),
            );
          }

          ensureStatementsHoisted(headers);
          path.unshiftContainer("body", headers);

          const {body, directives} = path.node;
          path.node.directives = [];
          path.node.body = [];

          const buildWrapper = this.hasRequire ? buildWithRequireWrapper : buildWithoutRequireWrapper;
          const buildWrapperOptions = {
            MODULE_NAME: moduleName,

            AMD_DEPENDENCIES: t.arrayExpression(amdDeps),
            AMD_ARGUMENTS: t.arrayExpression(amdArgs),
            BRUNCH_ARGUMENTS: brunchArgs,
            COMMONJS_ARGUMENTS: commonjsArgs,
            NODE_ARGUMENTS: nodeArgs,
            BROWSER_ARGUMENTS: browserArgs,
            IMPORT_NAMES: importNames,

            GLOBAL_TO_ASSIGN: buildBrowserInit(
              browserGlobals,
              exactGlobals,
              this.filename || "unknown",
              moduleName,
            )
          };

          if (this.hasRequire) {
            buildWrapperOptions.UMD_LOADER = opts.umdLoader || `(${ umdLoaderFactory.replace("RESOLVE_NAME", String(_resolveName)) })()`;
          }

          const umdWrapper = path.pushContainer("body", [
            buildWrapper(buildWrapperOptions),
          ])[0];
          const umdFactory = umdWrapper
            .get("expression.arguments")[1]
            .get("body");
          umdFactory.pushContainer("directives", directives);
          umdFactory.pushContainer("body", body);
        },
      },
    },
  };
});
