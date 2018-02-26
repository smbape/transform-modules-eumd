import { basename, extname } from "path";
import template from "babel-template";
import _getOpts from "./_getOpts";
import _resolveNameArg from "./_resolveNameArg";
import _parseDependency from "./_parseDependency";
import resolveName from "./_resolveName";
import amd from "./modules-amd";

const buildPrerequisiteAssignment = template(`
  GLOBAL_REFERENCE = GLOBAL_REFERENCE || {}
`);

const buildGlobalExport = template(`
  var mod = { exports: {} };
  factory(BROWSER_ARGUMENTS);
  PREREQUISITE_ASSIGNMENTS
  GLOBAL_TO_ASSIGN = mod.exports;
`);

const buildUMDWithoutRequire = template(`
  (function (global, factory) {
    if (typeof define === "function" && define.amd) {
      define(MODULE_NAME, AMD_DEPENDENCIES, function() {
        // eslint-disable-next-line no-invalid-this
        return factory.apply(global, AMD_ARGUMENTS);
      });
    } else if (typeof exports === "object" && typeof module !== "undefined") {
      if (typeof process === "object" && typeof process.platform !== "undefined") {
        factory.call(global, NODE_ARGUMENTS);
      } else if (global.require && global.require.brunch) {
        factory.call(global, BRUNCH_ARGUMENTS);
      } else {
        factory.call(global, COMMON_ARGUMENTS);
      }
    } else {
      GLOBAL_EXPORT
    }
  })((function(_this) {
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
  })(this), FUNC);
`);

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
          dep = (new Function("return " + dep.slice(1)))();
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
          dep = (new Function("return " + dep.slice(1)))();
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

const buildUMDWithRequire = params => template(`
  (function (global, factory, _require, umdLoader) {
    var require;

    if (typeof define === "function" && define.amd) {
      define(MODULE_NAME, AMD_DEPENDENCIES, function() {
        var args = AMD_ARGUMENTS;

        args[0] = umdLoader.amd(args[0], global);
        // eslint-disable-next-line no-invalid-this
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
        factory.call(global, COMMON_ARGUMENTS);
      }
    } else {
      GLOBAL_EXPORT
    }
  })((function(_this) {
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
  })(this), FUNC, typeof require === "undefined" ? undefined : require, ${ params.UMD_LOADER });
`)(params);

const globalMemberExpression = (t, node) => {
  const evaluated = /(?:^\d|\W)/.test(node.name);
  return t.memberExpression(t.identifier("global"), evaluated ? t.stringLiteral(node.name) : node, evaluated);
};

export default function({types: t}) {
  function isValidDefine(path) {
    if (!path.isExpressionStatement()) {
      return false;
    }

    const expr = path.get("expression");
    if (!expr.isCallExpression()) {
      return false;
    }
    if (!expr.get("callee").isIdentifier({
        name: "define"
      })) {
      return false;
    }

    const args = expr.get("arguments");

    // eslint-disable-next-line no-magic-numbers
    if (args.length === 3 && !args.shift().isStringLiteral()) {
      return false;
    }

    // eslint-disable-next-line no-magic-numbers
    if (args.length !== 2) {
      return false;
    }

    if (!args.shift().isArrayExpression()) {
      return false;
    }

    if (!args.shift().isFunctionExpression()) {
      return false;
    }

    return true;
  }

  return {
    inherits: amd,

    visitor: {
      Program: {
        exit(path, state) {
          if (this.ranUmdJs) {
            return;
          }
          this.ranUmdJs = true;

          const opts = _getOpts(path, state);

          if (opts.disabled || opts.explicitExtendedUmd && !opts.__inline) {
            return;
          }

          if (this.notEsm && opts.esmOnly) {
            return;
          }

          const last = path.get("body").pop();
          if (!isValidDefine(last)) {
            return;
          }

          const call = last.node.expression;
          const args = call.arguments;

          // eslint-disable-next-line no-magic-numbers
          const moduleName = args.length === 3 ? args.shift() : null;
          const func = call.arguments[1];
          const browserGlobals = opts.globals || {};

          const amdDeps = [];
          const amdArgs = [];
          const browserArgs = [];
          const brunchArgs = [];
          const commonArgs = [];
          const nodeArgs = [];

          const _resolveName = opts.resolveName || resolveName;
          const _umdLoader = opts.umdLoader || `(${ umdLoaderFactory.replace("RESOLVE_NAME", String(_resolveName)) })()`;
          let hasRequire = false;

          const amdArg = arg => {
            if (arg.type === "StringLiteral" && arg.value[0] === "!") {
              arg = globalMemberExpression(t, t.identifier(arg.value.slice(1)));
            }

            if (arg.type === "StringLiteral") {
              amdArgs.push(t.memberExpression(t.identifier("arguments"), t.numericLiteral(amdDeps.length), true));
              amdDeps.push(arg);
            } else {
              amdArgs.push(arg);
            }
          };

          const commonArg = (name, arg) => {
            if (arg === false) {
              switch (name) {
                case "brunch":
                  brunchArgs.pop();
                  break;
                case "common":
                  commonArgs.pop();
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
                  arg = globalMemberExpression(t, t.identifier(arg.value.slice(1)));
                } else {
                  arg = t.callExpression(t.identifier("require"), [arg]);
                }
            }

            switch (name) {
              case "brunch":
                brunchArgs.push(arg);
                break;
              case "common":
                commonArgs.push(arg);
                break;
              case "node":
                nodeArgs.push(arg);
                break;
              default:
                throw new Error(`Unknown environment ${ name }'`);
            }
          };

          const browserArg = arg => {
            if (arg.type === "Identifier") {
              // Do nothing
            } else if (arg.value === "module") {
              arg = t.identifier("mod");
            } else if (arg.value === "exports") {
              arg = t.memberExpression(t.identifier("mod"), t.identifier("exports"));
            } else if (arg.value[0] === "!") {
              arg = globalMemberExpression(t, t.identifier(arg.value.slice(1)));
            } else {
              let memberExpression;

              if (opts.exactGlobals) {
                const globalRef = browserGlobals[arg.value];
                if (globalRef) {
                  memberExpression = globalRef.split(".").reduce(
                    (accum, curr) => t.memberExpression(accum, t.identifier(curr)), t.identifier("global")
                  );
                } else {
                  memberExpression = globalMemberExpression(t, t.identifier(t.toIdentifier(arg.value)));
                }
              } else {
                const requireName = basename(arg.value, extname(arg.value));
                const globalName = browserGlobals[requireName] || requireName;
                memberExpression = globalMemberExpression(t, t.identifier(t.toIdentifier(globalName)));
              }

              arg = memberExpression;
            }

            browserArgs.push(arg);
          };

          call.arguments[0].elements.forEach((arg, i) => {
            if (arg.type === "StringLiteral") {
              try {
                if (_parseDependency(this, t, arg, amdArg, browserArg, commonArg, _resolveName)) {
                  return;
                }
              } catch ( err ) {
                throw last.buildCodeFrameError(`Invalid require ${ arg.value }: ${ err.message }`);
              }
            }

            arg = _resolveNameArg(_resolveName, arg);

            if (arg.value === "require") {
              hasRequire = true;
            }

            amdArg(arg);
            browserArg(arg);
            commonArg("brunch", arg);
            commonArg("common", arg);
            commonArg("node", arg);
          });

          const moduleNameOrBasename = moduleName ? moduleName.value : this.file.opts.basename;
          let globalToAssign = globalMemberExpression(t, t.identifier(t.toIdentifier(moduleNameOrBasename)));
          let prerequisiteAssignments = null;

          if (opts.exactGlobals) {
            const globalName = browserGlobals[moduleNameOrBasename];

            if (globalName) {
              prerequisiteAssignments = [];

              const members = globalName.split(".");
              globalToAssign = members.slice(1).reduce((accum, curr) => {
                prerequisiteAssignments.push(buildPrerequisiteAssignment({
                  GLOBAL_REFERENCE: accum
                }));
                return t.memberExpression(accum, t.identifier(curr));
              }, globalMemberExpression(t, t.identifier(members[0])));
            }
          }

          const globalExport = buildGlobalExport({
            BROWSER_ARGUMENTS: browserArgs,
            PREREQUISITE_ASSIGNMENTS: prerequisiteAssignments,
            GLOBAL_TO_ASSIGN: globalToAssign
          });

          last.replaceWith((hasRequire ? buildUMDWithRequire : buildUMDWithoutRequire)({
            MODULE_NAME: moduleName,
            AMD_DEPENDENCIES: t.arrayExpression(amdDeps),
            AMD_ARGUMENTS: t.arrayExpression(amdArgs),
            BRUNCH_ARGUMENTS: brunchArgs,
            COMMON_ARGUMENTS: commonArgs,
            NODE_ARGUMENTS: nodeArgs,
            GLOBAL_EXPORT: globalExport,
            UMD_LOADER: _umdLoader,
            FUNC: func
          }));
        }
      }
    }
  };
}
