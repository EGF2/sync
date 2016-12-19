"use strict";

const option = require("commons/option");
const elasticsearch = require("elasticsearch");
const bunyan = require("bunyan");

function init() {
    return option().config.then(config => {
        module.exports.config = config;
        module.exports.clientData = require("commons/client-data")(config["client-data"]);
        module.exports.elasticSearch = new elasticsearch.Client(config.elastic);
        module.exports.logger = bunyan.createLogger({
            name: "sync",
            level: config.log_level
        });
        return module.exports;
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = {
    init
};
