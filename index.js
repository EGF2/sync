"use strict";

const components = require("./components");
var http = require("http");

components.init().then(() => {
    var config = components.config;
    const server = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/healthcheck') {
            res.statusCode = 200;
        } else {
            res.statusCode = 404;
        }
        res.end();
      }).listen(config.port);

    require("./server")();
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
