/** @eumd */

import var1 from "!document";
import var2 from "%{ amd: '!define', browser: '!window', brunch: '!require', common: '!require', node: '!process' }";
import module2 from "./module2";
import waterfall from "%{ node: 'async/waterfall' }";

const fs = typeof require !== "function" ? undefined : require({ amd: "fs-amd", brunch: "!fs-brunch", common: "!fs-common", node: "fs" });

export default {
    key3: "value3",
    module2,
    var1,
    var2,
    waterfall,
    fs
};
