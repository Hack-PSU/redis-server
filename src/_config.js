let config = {};

//figure our mongoURI
let uriRoot = process.env.RUN_ENV || 'localhost';
// mongo uri
config.mongoURI = {
    development: "mongodb://" + uriRoot + "/node-stripe-charge",
    test: "mongodb://" + uriRoot + "/node-stripe-charge-test",
    stage: process.env.MONGOLAB_URI
};

module.exports = config;