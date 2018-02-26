const fs = require("fs");
const sysPath = require("path");
const babel = require("babel-core");
const eachOfLimit = require("async/eachOfLimit");
const waterfall = require("async/waterfall");
const rimraf = require("rimraf");
const mkdirp = require("mkdirp");

const options = {
    "plugins": [
        "add-module-exports",
        ["transform-es2015-modules-commonjs", { "strict" : true, "allowTopLevelThis": false }],
        "transform-flow-strip-types",
    ]
};

const lib = sysPath.resolve(__dirname, "../lib");
const src = sysPath.resolve(__dirname, "../src");

waterfall([
    next => {
        rimraf(lib, next);
    },
    next => {
        mkdirp(lib, next);
    },
    (made, next) => {
        fs.readdir(src, next);
    },
    (files, next) => {
        eachOfLimit(files, 8, (filename, i, next) => {
            options.filename = sysPath.join(src, filename);

            waterfall([
                next => {
                    fs.readFile(options.filename, next);
                },

                (code, next)=> {
                    const transpiled = babel.transform(code, options);
                    const dst = sysPath.join(lib, filename);
                    fs.writeFile(dst, transpiled.code, next);
                }
            ], next);
        }, next);
    }
], err => {
    if (err) {
        throw err;
    }
});
