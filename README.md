# transform-modules-eumd

Transform ES6 modules to UMD modules with per environment dependencies.

This a modified version of [babel-plugin-transform-es2015-modules-commonjs](https://www.npmjs.com/package/babel-plugin-transform-es2015-modules-commonjs), [babel-plugin-transform-es2015-modules-amd](https://www.npmjs.com/package/babel-plugin-transform-es2015-modules-amd) and [babel-plugin-transform-es2015-modules-umd](https://www.npmjs.com/package/babel-plugin-transform-es2015-modules-umd)  
Therefor, don't use any this module with any of them if you don't want unexpected results.

Only imports are treated as dependencies.

Requires instruction are left as is.

Options can be defined per file by adding a comment like this `/* @eumd { "repeat": "_.map" } */`


```javascript
// app/node_modules/some/path/module.js

import relative from './relative';          // look for module defined in app/node_modules/some/path/relative.js
import forAll from 'for-all';               // look for module defined in app/node_modules/for-all.js. In nodejs, will use the classic require
import globalForAll from '!global-for-all'; // look for global variable global-for-all

import specificPerEnv from "%{ common: 'use-this-in-single-page-mode', amd: 'use-this-in-amd-mode', node: 'use-this-in-nodejs' }";

// in single page, look for global variable global-for-all
// ignore other environments
import commonOnly from "%{ common: '!use-this-global-in-single-page-mode' }";

// Can also be used with require

// Dependency resolution will happend at runtime and the generated file will have a bigger overhead
// For that reason, use require only when you need computed dependencies
const nodeOnly = require({ node: "fs" });

// this require style is always supported
// it only loads modules asynchronously when in an AMD environment
// otherwise, it is just a wrapper for the commonjs require
require([ './relative',  'for-all', '!global-for-all', { node: "fs" }], (relative, forAll, globalForAll, nodeOnly) => {
    // ...
});
```

becomes

```javascript
(function (global, factory, _require, umdLoader) {
    var require;

    if (typeof define === "function" && define.amd) {
        define(['require', './relative', 'for-all', 'use-this-in-amd-mode'], function () {
            var args = [arguments[0], arguments[1], arguments[2], global['global-for-all'], arguments[3], undefined];
            args[0] = umdLoader.amd(args[0], global);
            return factory.apply(global, args);
        });
    } else if (typeof exports === "object" && typeof module !== "undefined") {
        if (typeof process === "object" && typeof process.platform !== "undefined") {
            require = umdLoader.common(_require, global, "node");
            factory.call(global, require, require('./relative'), require('for-all'), global['global-for-all'], require('use-this-in-nodejs'), undefined);
        } else if (global.require && global.require.brunch) {
            require = umdLoader.common(_require, global, ["brunch", "common"]);
            factory.call(global, require, require('./relative'), require('for-all'), global['global-for-all'], require('use-this-in-single-page-mode'), global['use-this-global-in-single-page-mode']);
        } else {
            require = umdLoader.common(_require, global, "common");
            factory.call(global, require, require('./relative'), require('for-all'), global['global-for-all'], require('use-this-in-single-page-mode'), global['use-this-global-in-single-page-mode']);
        }
    } else {
        var mod = {
            exports: {}
        };
        factory(global.require, global.relative, global.forAll, global['global-for-all'], undefined, undefined);
        global.readme = mod.exports;
    }
})(function (_this) {
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
}(this), function (require, _relative, _forAll, _globalForAll, _useThisInSinglePageMode, _useThisGlobalInSinglePageMode) {
    'use strict';

    var _relative2 = _interopRequireDefault(_relative);

    var _forAll2 = _interopRequireDefault(_forAll);

    var _globalForAll2 = _interopRequireDefault(_globalForAll);

    var _useThisInSinglePageMode2 = _interopRequireDefault(_useThisInSinglePageMode);

    var _useThisGlobalInSinglePageMode2 = _interopRequireDefault(_useThisGlobalInSinglePageMode);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    // Can also be used with require

    // Dependency resolution will happend at runtime and the generated file will have a bigger overhead
    // For that reason, use require only when you need computed dependencies
    // look for global variable global-for-all

    // look for module defined in app/node_modules/some/path/relative.js
    var nodeOnly = require({ node: "fs" });

    // this require style is always supported
    // it only loads modules asynchronously when in an AMD environment
    // otherwise, it is just a wrapper for the commonjs require


    // in single page, look for global variable global-for-all
    // ignore other environments
    // look for module defined in app/node_modules/for-all.js. In nodejs, will use the classic require
    // app/node_modules/some/path/module.js

    require(['./relative', 'for-all', '!global-for-all', { node: "fs" }], function (relative, forAll, globalForAll, nodeOnly) {
        // ...
    });
}, typeof require === "undefined" ? undefined : require, function umdLoaderFactory() {
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

    function resolveName(dep) {
        return dep.replace(/(?:(?:\\(.))|(\/\*{1,2})$)/g, function (match, _escape, pack) {
            if (_escape) {
                return _escape;
            }

            if (pack === "/*") {
                return "/package";
            }

            return "/deepack";
        });
    }

    function _processCommonDep(require, type, dep, _global, libs, errors, _interpolate) {
        if (dep == null) {
            libs.push(undefined);
            return;
        }

        var ex;

        switch (dep[0]) {
            case "!":
                if (typeof _global !== "object") {
                    throw new Error("global scope is not an object");
                }

                libs.push(_global[dep.slice(1)]);
                break;

            case "$":
                libs.push(undefined);
                break;

            default:
                if (_interpolate !== false && dep[0] === "%" && dep[1] === "{" && dep[dep.length - 1] === "}") {
                    dep = new Function("return " + dep.slice(1))();

                    _processCommonDep(require, type, dep, _global, libs, errors);

                    return;
                }

                dep = resolveName(dep);

                if (errors) {
                    try {
                        libs.push(require(dep));
                    } catch (error) {
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
        deps.forEach(function (dep) {
            var found;

            if (isObjectLike(dep)) {
                if (Array.isArray(type)) {
                    found = null;
                    type.some(function (name) {
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
                if (typeof _global !== "object") {
                    throw new Error("global scope is not an object");
                }

                availables[index] = _global[dep.slice(1)];
                break;

            case "$":
                availables[index] = undefined;
                break;

            default:
                if (_interpolate !== false && dep[0] === "%" && dep[1] === "{" && dep[dep.length - 1] === "}") {
                    dep = new Function("return " + dep.slice(1))();

                    _processAmdDep(_global, libs, availables, map, dep, index, false);

                    return;
                }

                map[libs.length] = index;
                dep = resolveName(dep);
                libs.push(dep);
        }
    }

    function amdRequire(require, deps, callback, errback, options, _global) {
        if (typeof deps === "string" || isPlainObject(deps)) {
            deps = [deps];
        } else if (typeof deps === "undefined") {
            deps = [];
        }

        var libs = [];
        var availables = [];
        var map = {};
        deps.forEach(function (dependency, index) {
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

        require(libs, function () {
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
}());
```

## Options

All options defined in [babel-plugin-transform-es2015-modules-commonjs](https://www.npmjs.com/package/babel-plugin-transform-es2015-modules-commonjs)

### disabled `<Boolean>`

Don't transform the code. Best used as a file option

### explicitExtendedUmd `<Boolean>`

Only transform when the code contain `/* @eumd */` comment.

### esmOnly `<Boolean>`

Only transform when there is an `import` or `export` instruction.

# License

The MIT License (MIT)

Copyright (c) 2018 Stéphane MBAPE (http://smbape.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
