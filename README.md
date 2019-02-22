# transform-modules-eumd

Transform ES6 modules to UMD modules with per environment dependencies.

This a modified version of [@babel/plugin-transform-modules-umd](https://www.npmjs.com/package/@babel/plugin-transform-modules-umd)  .

Options can be defined per file by adding a comment like this `/* @eumd { "allowTopLevelThis": true } */`


## Example


```javascript
import relative from './relative';          // look for module defined in app/node_modules/some/path/relative.js
import forAll from 'for-all';               // look for module defined in app/node_modules/for-all.js. In nodejs, will use the classic require
import globalForAll from '!global-for-all'; // look for global variable global-for-all

// look for global jQuery in commonjs environment
// look for jQuery in amd environment
// look for cheerio in nodejs environment
import $ from "%{ common: '!jQuery', amd: 'jQuery', node: 'cheerio' }";

// look for global variable global-for-use-this-global-in-commonjs in commonjs environment
// ignore other environments (amd, nodejs)
import commonOnly from "%{ common: '!use-this-global-in-commonjs' }";

// Dependency resolution will happend at runtime and the generated file will have a bigger overhead
// For that reason, use require only when you need computed dependencies
const fs = require({ node: "fs" });
if (fs) {
    // do specific nodejs code
}

// this require style is always supported
// it only loads modules asynchronously when in an AMD environment
// otherwise, it is just a wrapper for the commonjs/nodejs require
require([ './relative',  'for-all', '!global-for-all', { node: "fs" }], (relative, forAll, globalForAll, nodeOnly) => {
    // ...
});
```


## Options

### `loose`

`boolean`, defaults to `false`.

As per the spec, `import` and `export` are only allowed to be used at the top level. When in loose mode these are allowed to be used anywhere.

And by default, when using exports with babel a non-enumerable `__esModule` property is exported.

```javascript
var foo = exports.foo = 5;

Object.defineProperty(exports, "__esModule", {
  value: true
});
```

In environments that don't support this you can enable loose mode on `babel-plugin-transform-es2015-modules-commonjs` and instead of using `Object.defineProperty` an assignment will be used instead.

```javascript
var foo = exports.foo = 5;
exports.__esModule = true;
```

### `strict`

`boolean`, defaults to `false`

By default, when using exports with babel a non-enumerable `__esModule` property is exported. In some cases this property is used to determine if the import _is_ the default export or if it _contains_ the default export.

```javascript
var foo = exports.foo = 5;

Object.defineProperty(exports, "__esModule", {
  value: true
});
```

In order to prevent the `__esModule` property from being exported, you can set the `strict` option to `true`.

### `noInterop`

`boolean`, defaults to `false`

By default, when using exports with babel, a non-enumerable `__esModule` property is exported. This property is then used to determine if the import _is_ the default export or if it _contains_ the default export.

```javascript
"use strict";

var _foo = require("foo");

var _foo2 = _interopRequireDefault(_foo);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
```

In cases where the auto-unwrapping of `default` is not needed, you can set the `noInterop` option to `true` to avoid the usage of the `interopRequireDefault` helper (shown in inline form above).

### globals

`Object`.

There are a few things to note about the default semantics.

_First_, this transform uses the [basename](https://en.wikipedia.org/wiki/Basename) of each import to generate the global names in the UMD output. This means that if you're importing multiple modules with the same basename, like:

```javascript
import fooBar1 from "foo-bar";
import fooBar2 from "./mylib/foo-bar";
```

it will transpile into two references to the same browser global:

```javascript
factory(global.fooBar, global.fooBar);
```

If you set the plugin options to:

```json
{
  "globals": {
    "foo-bar": "fooBAR",
    "./mylib/foo-bar": "mylib.fooBar"
  }
}
```

it will still transpile both to one browser global:

```javascript
factory(global.fooBAR, global.fooBAR);
```

because again the transform is only using the basename of the import.

_Second_, the specified override will still be passed to the `toIdentifier` function in [babel-types/src/converters](https://github.com/babel/babel/blob/6.x/packages/babel-types/src/converters.js). This means that if you specify an override as a member expression like:

```json
{
  "globals": {
    "fizzbuzz": "fizz.buzz"
  }
}
```

this will not transpile to `factory(global.fizz.buzz)`. Instead, it will transpile to `factory(global.fizzBuzz)` based on the logic in `toIdentifier`.

_Third_, you cannot override the exported global name.

### exactGlobals

`boolean`, defaults to `false`.

More flexible semantics with `exactGlobals: true`

All of these behaviors can limit the flexibility of the `globals` map. To remove these limitations, you can set the `exactGlobals` option to `true`. Doing this instructs the plugin to:


  * always use the full import string instead of the basename when generating the global names
  * skip passing `globals` overrides to the `toIdentifier` function. Instead, they are used exactly as written, so you will get errors if you do not use valid identifiers or valid uncomputed (dot) member expressions.
  * allow the exported global name to be overridden via the `globals` map. Any override must again be a valid identifier or valid member expression.

Thus, if you set `exactGlobals` to `true` and do not pass any overrides, the first example of:

```javascript
import fooBar1 from "foo-bar";
import fooBar2 from "./mylib/foo-bar";
```

will transpile to:

```javascript
factory(global.fooBar, global.mylibFooBar);
```

And if you set the plugin options to:

```json
{
  "globals": {
    "foo-bar": "fooBAR",
    "./mylib/foo-bar": "mylib.fooBar"
  },
  "exactGlobals": true
}
```


then it'll transpile to:

```javascript
factory(global.fooBAR, global.mylib.fooBar);
```

### strictMode

`boolean`, defaults to `true`.

Add `use strict` instruction.

### explicitExtendedUmd

`boolean`, defaults to `false`.

Only transform when the code contains `/* @eumd */` comment.

### esmOnly

`boolean`, defaults to `false`.

Only transform when there is an `import` or `export` instruction.

### addModuleExports

`boolean`, defaults to `false`.

Add the `module.exports` if *only* the export `default` declaration exists.

Transpile

```javascript
export default 'foo'
```

into

```javascript
'use strict';
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = 'foo';
module.exports = exports['default'];
```

### addDefaultProperty

`boolean`, defaults to `false`.

If you're exporting an object and wish to maintain compatibility with code using the `require('./bundle.js').default` syntax, you can optionally enable the `addDefaultProperty` option.

This will cause a second line of code to be added which aliases the `default` name to the exported object like so:

```javascript
module.exports = exports['default'];;
module.exports.default = exports['default'];
```

### allowTopLevelThis

`boolean`, defaults to `false`.

According to [ECMAScript® 2015 Language Specification](http://www.ecma-international.org/ecma-262/6.0/#sec-strict-mode-code), module code is always strict mode code.

In strict mode, top level `this` is `undefined`.

Therefore, by default, top level `this` are replaced with `undefined` or `void 0`.

However, you may have code where top level `this` was meant for `global` scope, i.e. `window` in browsers and `global` in nodejs.

To still be able to use top level `this`, set `allowTopLevelThis` to `true`.

### disabled

`boolean`, defaults to `false`.

Don't transform the code. Best used as a file option

# License

The MIT License (MIT)

Copyright (c) 2018-2019 Stéphane MBAPE (https://smbape.com)

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
