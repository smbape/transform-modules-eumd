/* eslint-env browser */
/* globals requirejs */

(function() {
    "use strict";

    const config = {
        baseUrl: "/base/test/node_modules",
        paths: {
            path: "../amd/path",
            chai: "../amd/chai"
        }
    };

    requirejs.config(config);

    require(["path", "chai"], (sysPath, chai) => {
        window.expect = chai.expect;

        const deps = [];

        // add test files
        Object.keys(window.__karma__.files).forEach(file => {
            if (/-test\.js$/.test(file)) {
                deps.push(pathToModule(file));
            }
        });

        // We have to kickoff testing framework,
        // after RequireJS is done with loading all the files.
        require(deps, window.__karma__.start);

        // Normalize a path to RequireJS module name.
        function pathToModule(path) {
            return sysPath.relative(config.baseUrl, path).replace(/\.js$/, "");
        }
    });
}());
