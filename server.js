"use strict";

const config = require("./components").config;
const elastic = require("./components").elasticSearch;
const log = require("./components").logger;
const eventConsumer = require("commons/event-consumer");
const clientData = require("./components").clientData;

// prepare handlers
let handlers = require("./extra");

function addToHandlers(key, handler) {
    if (key in handlers) {
        let prev = handlers[key];
        handlers[key] = event =>
            Promise.all([
                prev(event),
                handler(event)
            ]);
    } else {
        handlers[key] = handler;
    }
}

Object.keys(config.elastic.indices).forEach(index => {
    let indexCfg = config.elastic.indices[index];
    if (indexCfg.object_type) {
        // add POST handler
        addToHandlers(`POST ${indexCfg.object_type}`, event => {
            let body = {};
            Object.keys(indexCfg.mapping).forEach(field => {
                let selector = indexCfg.mapping[field].field_name || field;
                body[field] = getValue(event.current, selector);
            });
            return elastic.index({
                index: index,
                type: index,
                id: event.object,
                body
            });
        });

        // add PUT handler
        addToHandlers(`PUT ${indexCfg.object_type}`, event => {
            let doc = {};
            Object.keys(indexCfg.mapping).forEach(field => {
                if (event.current[field] !== event.previous[field]) {
                    let selector = indexCfg.mapping[field].field_name || field;
                    doc[field] = getValue(event.current, selector);
                }
            });
            if (Object.keys(doc).length === 0) {
                return Promise.resolve();
            }
            return elastic.update({
                index: index,
                type: index,
                id: event.object,
                body: {doc}
            });
        });

        // add DELETE handler
        addToHandlers(`DELETE ${indexCfg.object_type}`, event => {
            return elastic.delete({
                index: index,
                type: index,
                id: event.object
            });
        });
    }
});

function getValue(obj, field) {
    let value = obj;
    field.split(".").forEach(field => {
        value = value[field];
    });
    return value;
}

// create indices with mapping
function createIndex(index, mapping, settings) {
    let properties = {};
    Object.keys(mapping).forEach(field => {
        properties[field] = Object.assign({}, mapping[field]);
        delete properties[field].field_name;
    });
    return elastic.indices.exists({index: index}).then(exists => {
        if (exists) {
            return elastic.indices.putMapping({ // merge mapping
                index: index,
                type: index,
                body: {
                    properties
                }
            });
        }
        let body = {
            mappings: {
                [index]: {
                    properties
                }
            }
        };
        if (settings) {
            body.settings = {
                analysis: settings
            };
        }
        // create index
        return elastic.indices.create({index, body});
    });
}

// mapping indexes in ElasticSearch
function mappingIndexes() {
    let promises = Promise.resolve();
    Object.keys(config.elastic.indices).forEach(index => {
        let indexCfg = config.elastic.indices[index];
        promises = promises.then(() =>
            createIndex(index, indexCfg.mapping, indexCfg.settings)
        );
    });
    return promises.catch(err => {
        log.fatal(err);
        process.exit(1);
    });
}

// handle events
function eventHandler(event) {
    return Promise.resolve(event.method).then(method => {
        if (event.object) {
            if (event.current) {
                return `${method} ${event.current.object_type}`;
            }
            return `${method} ${event.previous.object_type}`;
        }
        return Promise.all([
            clientData.getObjectType(event.edge.src),
            clientData.getObjectType(event.edge.dst)
        ]).then(types => `${method} ${types[0]}/${event.edge.name}/%{types[1]}`);
    }).then(path => path in handlers ? handlers[path](event) : undefined);
}

function errorHandler(error) {
    log.error(error);
}

function createServer() {
    mappingIndexes().then(() => {
        eventConsumer(config, eventHandler, errorHandler);
    });
}
module.exports = createServer;
