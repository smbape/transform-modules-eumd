import * as t from "babel-types";
import _getOpts from "./_getOpts";

export default function() {
  return {
    visitor: {
      Program(path, state) {
        const opts = _getOpts(path, state);

        if (opts.disabled || opts.explicitExtendedUmd && !opts.__inline) {
          return;
        }

        if (opts.strict === false || opts.strictMode === false) {
          return;
        }

        const {node} = path;

        for (const directive of (node.directives: Array<Object>)) {
          if (directive.value.value === "use strict") {
            return;
          }
        }

        path.unshiftContainer("directives", t.directive(t.directiveLiteral("use strict")));
      }
    }
  };
}
