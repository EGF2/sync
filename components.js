"use strict";

const option = require("commons/option");
const elasticsearch = require("elasticsearch");
const bunyan = require("bunyan");
require("dotenv").config();

function init() {
    return option().config.then(config => {
        for (let key in config) {
            if (process.env[key]) {
                try {
                    config[key] = JSON.parse(process.env[key]);
                } catch (e) {
                    config[key] = process.env[key];
                }
            }
        }

        const log = bunyan.createLogger({
            name: "sync",
            level: config.log_level
        });

        log.info({config});

        module.exports.config = config;
        module.exports.clientData = require("commons/client-data")(config["client-data"]);
        module.exports.elasticSearch = new elasticsearch.Client(config.elastic);
        module.exports.logger = log;
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
