/* eslint-env browser */

describe("amd-test", () => {
    "use strict";

    let module1, module2, module3;

    it("should require with no dependencies", done => {
        require(["module1"], _module1 => {
            module1 = _module1;
            expect(module1).to.deep.equal({
                key1: "value1"
            });
            done();
        }, done);
    });

    it("should require with local dependencies", done => {
        require(["module2"], _module2 => {
            module2 = _module2;
            expect(module2).to.deep.equal({
                key2: "value2",
                module1
            });
            expect(module2.module1).to.equal(module1);
            done();
        }, done);
    });

    it("should require local umd as well as node modules and native modules", done => {
        window.define("fs-amd", Symbol("fs"));

        require(["fs-amd", "module3"], (fs, _module3) => {
            module3 = _module3;
            expect(module3).to.deep.equal({
                key3: "value3",
                module2,
                var1: window.document,
                var2: window.define,
                waterfall: undefined,
                fs
            });
            expect(module3.module2).to.equal(module2);
            done();
        }, done);
    });
});
