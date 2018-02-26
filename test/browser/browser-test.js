/* eslint-env browser */

const expect = require("chai").expect;

describe("browser", () => {
    let module1, module2, module3;

    it("should require with no dependencies", () => {
        module1 = window.module1;
        expect(module1).to.deep.equal({
            key1: "value1"
        });
    });

    it("should require with local dependencies", () => {
        module2 = window.module2;
        expect(module2).to.deep.equal({
            key2: "value2",
            module1
        });
        expect(module2.module1).to.equal(module1);
    });

    it("should require local umd as well as node modules and native modules", () => {
        module3 = window.module3;
        expect(module3).to.deep.equal({
            key3: "value3",
            module2,
            var1: window.document,
            var2: window,
            waterfall: undefined,
            fs: undefined
        });
        expect(module3.module2).to.equal(module2);
    });
});
