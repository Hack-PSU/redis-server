/**
 * Created by PranavJain on 2/22/17.
 */

/*check if in docker or no*/
let request = require("request-promise-native");
const firebase = require('firebase');
const asyncMiddleware = require('../lib/asyncMiddleware');

let server;
let hostname = process.env.SERVER_HOSTNAME || 'http://localhost';
let hostport = process.env.SERVER_PORT || '5000';
let serverVersion = process.env.SERVER_VERSION || 'v1';
let serverAPIkey = process.env.SERVER_API_KEY || 'rediskey';

server = hostname + ':' + hostport + '/' +  serverVersion;
console.log(server);

//get Server
async function getToken(){
  firebase.initializeApp({
    apiKey: process.env.APIKEY,
    authDomain: process.env.AUTHDOMAIN,
    databaseURL: process.env.DATABASEURL,
    projectId: process.env.PROJECTID,
    storageBucket: process.env.STORAGEBUCKET,
    messagingSenderId: process.env.MESSAGINGSENDERID,
  });
  await firebase.auth().signInWithEmailAndPassword(process.env.API_EMAIL, process.env.API_PASS);
  let idToken = await firebase.auth().currentUser.getIdToken(true);
  let options = {
    method: 'GET',
    uri: server + "/scanner/register",
    headers: {
      'idtoken': idToken
    },
    json: true
  };
  let pinRes = await request(options);
  let pin = pinRes.body.data.pin;
  options.method = "POST";
  options.headers.idtoken = "";
  options.headers.macaddr = "REDIS";
  options.body = {
    pin: pin
  };
  let keyRes = await request(options);
  return keyRes.body.data.key;

}


module.exports = (async function(){
  //some async initializers
  //e.g. await the db module that has the same structure like this
  let token = await getToken();
  console.log("TOKEN: " + token);
  let serverOptions = {
    method: 'GET',
    uri: server,
    headers: {
      'apikey': token,
      'macaddr': "REDIS"
    },
    json: true
  };

  console.log(serverOptions);
  //resolve the export promise
  return serverOptions;
})();


