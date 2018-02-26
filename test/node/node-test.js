const babel = require("babel-core");
const fs = require("fs");
const sysPath = require("path");
const rimraf = require("rimraf");
const mkdirp = require("mkdirp");
const waterfall = require("async/waterfall");
const explore = require("fs-explorer").explore;
const expect = require("chai").expect;

const umd_modules = sysPath.resolve(__dirname, "../umd_modules");
const node_modules = sysPath.resolve(__dirname, "node_modules");

const spec = () => {
    let module1, module2, module3;

    it("should require with no dependencies", () => {
        module1 = require(sysPath.join(node_modules, "module1"));
        expect(module1).to.deep.equal({
            key1: "value1"
        });
    });

    it("should require with local dependencies", () => {
        module2 = require(sysPath.join(node_modules, "module2"));
        expect(module2).to.deep.equal({
            key2: "value2",
            module1
        });
        expect(module2.module1).to.equal(module1);
    });

    it("should require local umd as well as node modules and native modules", () => {
        global.document = "#document";
        module3 = require(sysPath.join(node_modules, "module3"));
        expect(module3).to.deep.equal({
            key3: "value3",
            module2,
            var1: global.document,
            var2: process,
            waterfall,
            fs
        });
        expect(module3.module2).to.equal(module2);

        // make sure next spec throws if modules where not reloaded
        delete module3.module2;
        delete module2.module1;
    });
};

const babelOptions = {
    plugins: [
        "add-module-exports",
        [require("../../"), {
            strict: false,
            allowTopLevelThis: true,
            explicitExtendedUmd: true
        }]
    ]
};

describe("node-prebuild", () => {
    before(done => {
        waterfall([
            next => {
                rimraf(node_modules, next);
            },

            next => {
                mkdirp(node_modules, next);
            },
            (made, next) => {
                explore(umd_modules, (_filename, stats, callback) => {
                    const dst = sysPath.join(node_modules, sysPath.relative(umd_modules, _filename));
                    delete require.cache[dst];

                    fs.readFile(_filename, (err, buffer) => {
                        const code = babel.transform(buffer, Object.assign({
                            filename: _filename
                        }, babelOptions)).code;
                        fs.writeFile(dst, code, callback);
                    });
                }, next);
            }
        ], done);
    });

    after(done => {
        rimraf(node_modules, done);
    });

    spec();
});

describe("node-register", () => {
    before(done => {
        waterfall([
            next => {
                rimraf(node_modules, next);
            },

            next => {
                mkdirp(node_modules, next);
            },
            (made, next) => {
                explore(umd_modules, (_filename, stats, callback) => {
                    const dst = sysPath.join(node_modules, sysPath.relative(umd_modules, _filename));
                    delete require.cache[dst];

                    const readable = fs.createReadStream(_filename);
                    const writable = fs.createWriteStream(dst);

                    writable.on("error", callback);
                    readable.on("close", callback);

                    readable.pipe(writable);
                }, next);
            },

            next => {
                const wrapLoadFile = _loadFile => {
                    return (module, filename) => {
                        const _compile = module._compile;

                        module._compile = (data, _filename) => {
                            data = babel.transform(data, Object.assign({
                                filename: _filename
                            }, babelOptions)).code;
                            return _compile.call(module, data, _filename);
                        };

                        _loadFile(module, filename);
                    };
                };

                const register = () => {
                    if (require.extensions == null) {
                        return;
                    }

                    // eslint-disable-next-line guard-for-in
                    for (const ext in require.extensions) {
                        require.extensions[ext] = wrapLoadFile(require.extensions[ext]);
                    }
                };

                register();
                next();
            }
        ], done);
    });

    after(done => {
        rimraf(node_modules, done);
    });

    spec();
});
