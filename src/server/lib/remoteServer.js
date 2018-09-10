/**
 * Created by PranavJain on 2/22/17.
 */

/*check if in docker or no*/
var request = require("request-promise-native");

var server;
var hostname = process.env.SERVER_HOSTNAME || 'http://localhost';
var hostport = process.env.SERVER_PORT || '5000';
var serverAPIkey = process.env.SERVER_API_KEY || 'rediskey';

server = hostname + ':' + hostport;
console.log(server);
var serverOptions = {
    method: 'GET',
    uri: server,
    headers: {
        'apikey': serverAPIkey
    },
    json: true
};

//test
/*
request(options)
    .then(function (response) {
        // Request was successful, use the response object at will
        console.log(response);
    })
    .catch(function (err) {
        // Something bad happened, handle the error
        console.log(err);
    });*/

module.exports = serverOptions;
