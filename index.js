"use strict";

const components = require("./components");

components.init().then(() => {
    require("./server")();
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
