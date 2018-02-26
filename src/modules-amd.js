import template from "babel-template";
import _getOpts from "./_getOpts";
import commonjs from "./modules-commonjs";

const buildDefine = template(`
  define(MODULE_NAME, [SOURCES], FACTORY);
`);

const buildFactory = template(`
  (function (PARAMS) {
    BODY;
  })
`);

export default function({types: t}) {
  function isRequireCall(path) {
    if (!path.isCallExpression()) {
      return false;
    }
    if (!path.get("callee").isIdentifier({
        name: "require"
      })) {
      return false;
    }
    if (path.scope.getBinding("require")) {
      return false;
    }
    return true;
  }

  function isLiteralCall(path) {
    const args = path.get("arguments");
    if (args.length !== 1) {
      return false;
    }

    const arg = args[0];
    if (!arg.isStringLiteral()) {
      return false;
    }

    return true;
  }

  const amdVisitor = {
    ReferencedIdentifier({node, scope}) {
      if (node.name === "exports" && !scope.getBinding("exports")) {
        this.hasExports = true;
      }

      if (node.name === "module" && !scope.getBinding("module")) {
        this.hasModule = true;
      }
    },

    CallExpression(path) {
      if (!isRequireCall(path)) {
        return;
      }

      if (!path.node._fromImport) {
        this.hasRequire = true;
        return;
      }

      if (!isLiteralCall(path)) {
        return;
      }

      this.bareSources.push(path.node.arguments[0]);
      path.remove();
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

      if (!init.node._fromImport) {
        this.hasRequire = true;
        return;
      }

      if (!isLiteralCall(init)) {
        return;
      }

      const source = init.node.arguments[0];
      this.sourceNames[source.value] = true;
      this.sources.push([id.node, source]);

      path.remove();
    }
  };

  return {
    inherits: commonjs,

    pre() {
      // source strings
      this.sources = [];
      this.sourceNames = Object.create(null);

      // bare sources
      this.bareSources = [];

      this.hasExports = false;
      this.hasModule = false;
      this.hasRequire = false;
    },

    visitor: {
      Program: {
        exit(path, state) {
          if (this.ranAmdJs) {
            return;
          }
          this.ranAmdJs = true;

          const opts = _getOpts(path, state);

          if (opts.disabled || opts.explicitExtendedUmd && !opts.__inline) {
            return;
          }

          if (this.notEsm && opts.esmOnly) {
            return;
          }

          path.traverse(amdVisitor, this);

          const params = this.sources.map(source => source[0]);
          let sources = this.sources.map(source => source[1]);

          sources = sources.concat(this.bareSources.filter(str => {
            return !this.sourceNames[str.value];
          }));

          let moduleName = this.getModuleName();
          if (moduleName) {
            moduleName = t.stringLiteral(moduleName);
          }

          if (this.hasExports) {
            sources.unshift(t.stringLiteral("exports"));
            params.unshift(t.identifier("exports"));
          }

          if (this.hasModule) {
            sources.unshift(t.stringLiteral("module"));
            params.unshift(t.identifier("module"));
          }

          if (this.hasRequire) {
            sources.unshift(t.stringLiteral("require"));
            params.unshift(t.identifier("require"));
          }

          const {node} = path;
          const factory = buildFactory({
            PARAMS: params,
            BODY: node.body
          });
          factory.expression.body.directives = node.directives;
          node.directives = [];

          node.body = [buildDefine({
            MODULE_NAME: moduleName,
            SOURCES: sources,
            FACTORY: factory
          })];
        }
      }
    }
  };
}
