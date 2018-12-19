/**
 * Created by PranavJain on 2/20/17.
 */
let express = require('express');
let router = express.Router();

let passport = require('../../lib/auth');
let helpers = require('../../lib/helpers');
let redis = require('../../lib/redis').redis;
let redisIsConnected = require('../../lib/redis').redisIsConnected;
let request = require("request-promise-native");
let serverOptions = require('../../lib/remoteServer');


/**
 * @apiDefine UserData
 *
 * @apiSuccess {String} status          Status of response.
 * @apiSuccess {Object} data            User tab information.
 * @apiSuccess {String} data.uid        User's universal ID in remote db
 * @apiSuccess {String} data.pin        User's pin used to check-in
 * @apiSuccess {String} data.name       User's full name
 * @apiSuccess {String} data.shirtSize  User's shirt size
 * @apiSuccess {String} data.diet       User's dietary restrictions
 * @apiSuccess {Number} data.counter    Food counter for user.
 * @apiSuccess {Number} data.numScans   Number of scans taken for user (excluding food).
 * @apiSuccess {String} message         Response Message.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status": "success",
 *       "data": {
 *         "uid": "nXNR0z8CrgT4TduIM6y0DpN6wRj1",
 *         "pin": "96",
 *         "name": "Dat Boi",
 *         "shirtSize": "M",
 *         "diet": "Vegetarian",
 *         "counter": 0,
 *         "numScans": 0
 *       },
 *       "message": "Successfully completed task."
 *     }
 */
//todo: move queues to redis
//TODO: Switch to maps
let unsent_scans = [];
let unsent_assignments = [];



//authorization functions
//all functions with "requireAuth" used to have helpers.ensureAuthenticated

/**
 * @api {post} /tabs/setup Register RFID Band to User
 * @apiVersion 1.0.0
 * @apiName Register RFID
 * @apiGroup RFID
 * @apiDescription
 * Register RFID Band to User. Sends assignment to main server, while locally replacing user key to RFID code.
 * @apiPermission Scanner
 *
 * @apiParam {Number} rfid  RFID code to set to user.
 * @apiParam {Number} pin Pin of user to add rfid code to.
 * @apiParam {String} apikey API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       rfid: "RFID1",
 *       pin: 94,
 *       apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *     }
 *
 * @apiSuccess {String} status  Status of response.
 * @apiSuccess {Object} data    Response from Redis.
 * @apiSuccess {String} message Response message.
 *
 * @apiSuccessExample {json} Success Response:
 *    HTTP/1.1 200 OK
 *    {
 *      status: "success",
 *      data: "OK",
 *      message: "Created tab."
 *    }
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid values passed for rfid or pin"
 * @apiErrorExample {json} 404 Response
 *     HTTP/1.1 404 Not Found
 *     {
 *       status: "error",
 *       data: {'err...'},
 *       message: "Invalid pin"
 *     }
 * @apiErrorExample {json} 409 Response
 *     HTTP/1.1 409 Not Found
 *     {
 *       status: 'error',
 *       data: {'Existing User data...'},
 *       message: 'RFID Tag already opened.'
 *     }
 */
//TODO: rename to /scanner/assignment
router.post('/setup', helpers.ensureScannerAuthenticated, function (req, res, next) {
  if(!req.body || !req.body.rfid || !req.body.pin){
    console.error("Invalid values passed for rfid or pin");
    return res.status(401).send(new Error("Invalid values passed for rfid or pin"));
  }
  let userRFID = req.body.rfid;
  //we know pin exists
  let pin = parseInt(req.body.pin, 10);

  console.log("OPENING TAB WITH USER: " + userRFID);
  console.log("WE HAVE PIN: " + pin);
  if(!redisIsConnected()){
      return res.status(500)
          .json({
              status: 'error',
              message: 'Redis database is down'
          });
  }
  redis.hgetall(userRFID, function (err, obj) {
    if (err) {
      return res.status(500)
        .json({
          status: 'error',
          message: 'Something went wrong'
        });
    } else {
      console.log(obj);
      if (obj) {
        return res.status(409)
          .json({
            status: 'error',
            data: obj,
            message: 'RFID Tag already opened.'
          });
      } else {
        redis.rename(pin, userRFID, function (err, reply) {
          // returns error if couldn't find pin...
          if (err) {
            console.log("ERR Could not find pin: " + err);
            res.status(404).json({
              status: "error",
              data: err,
              message: "Invalid pin"
            });
          } else {
            console.log("Successfully set rfid to tab!");
            res.status(200)
              .json({
                status: 'success',
                data: reply,
                message: 'Created tab.'
              });
            //send rfid change to server asynchronously
            //get user
            redis.hgetall(userRFID, function (err, obj) {
              if (err) {
                console.log(err);
              } else {
                console.dir(obj);

                //prep request to send asynch
                let options = helpers.clone(serverOptions);
                options.method = 'POST';
                options.uri = options.uri + '/v1/scanner/assignment';
                let scan = {
                  "rfid": userRFID,
                  "uid": obj.uid,
                  "time": Date.now()
                };
                //TODO: check if this won't have race condition with unsent_assignments being reset
                unsent_assignments.push(scan);
                options.body = {
                  assignments: unsent_assignments
                };
                console.dir(unsent_assignments);
                /*
                  200 if everything is success
                  207 if partial failure
                    - ones that succeeded will have the original scan
                    - ones that failed, it will contain an error with a status code
                    (409 = DUPLICATE or invalid relation) (500 for other issues)
                  400 if formatting of sent info is bad
                  409 if Duplicate
                  500 if everything failed
                 */
                request(options).then(function (response) {
                  console.dir("SUCCESS: " + JSON.stringify(response));
                  let newUnsent_assign = [];
                  if(response.statusCode === 207){
                    response.forEach(function (item) {
                      if(item instanceof Error){
                        if(item.status >= 500){
                          //bad response from server, retry scan
                          newUnsent_assign.push(item.body.scan);
                        }else if(item.status >= 400){
                          //bad request, drop from list
                          console.error(item.body.message);
                        }
                      }
                    });
                  }
                  unsent_assignments = newUnsent_assign;

                }).catch(function (err) {
                  // Something bad happened, handle the error 400 and 500 errors
                  console.log(err.message);
                  //TODO: if duplicate entry, delete that entry otherwise everything will always fail.
                  //don't delete unsent_assignments...
                  if(err.statusCode >= 500){
                    //bad response from server, retry scan
                  }else{
                    //bad request, drop from list
                    unsent_assignments = [];
                  }
                });
              }
            });


          }
        });
      }
    }
  });


});


/**
 * @api {post} /tabs/getpin Get User with Pin
 * @apiVersion 1.0.0
 * @apiName GetPin
 * @apiGroup RFID
 * @apiDescription
 * Get all user information from redis that hasn't been assigned an rfid tag.
 * Pin is used to currently index user in redis if rfid hasn't been set.
 * @apiPermission Scanner
 *
 * @apiParam {Number} pin Pin of user.
 * @apiParam {String} apikey API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       pin: 94,
 *       apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *     }
 *
 * @apiUse UserData
 *
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid values passed for pin"
 * @apiErrorExample {json} 404 Response
 *     HTTP/1.1 404 Not Found
 *     {
 *       status: "error",
 *       data: {},
 *       message: "Did not find anything"
 *     }
 */
router.post('/getpin', helpers.ensureScannerAuthenticated, function (req, res, next) {
  if(!req.body || !req.body.pin){
    console.error("Invalid values passed for pin");
    return res.status(401).send(new Error("Invalid values passed for pin"));
  }
  let pin = parseInt(req.body.pin, 10);
  console.log("PIN IS: " + pin);
    if(!redisIsConnected()){
        return res.status(500)
            .json({
                status: 'error',
                message: 'Redis database is down'
            });
    }
  redis.hgetall(pin, function (err, obj) {
    if (err) {
      res.status(404)
        .json({
          status: 'error',
          message: 'Does not exist or already set.'
        });
    } else {
      console.dir(obj);
      if (obj) {
        res.status(200)
          .json({
            status: 'success',
            data: obj,
            message: 'Found.'
          });
      } else {
        res.status(404)
          .json({
            status: 'error',
            data: obj,
            message: 'Did not find anything.'
          });
      }
    }
  });
});


//DOC: increment counter to tab of rfid: https://redis.io/commands/hincrby
/**
 * @api {post} /tabs/add Add User Scan
 * @apiVersion 1.0.0
 * @apiName ScanData
 * @apiGroup RFID
 * @apiDescription
 * Store and log scan location, rfid tag and timestamp. Verify if user is allowed to enter, and send response back.
 * Redis will also send the scan data to the main server asynchronously. Scanners will not find out if those requests will succeed or fail.
 * @apiPermission Scanner
 *
 * @apiParam {Number} rfid        RFID code of user.
 * @apiParam {Number} location  Location id that scan occurred at. (Set id's in admin app)
 * @apiParam {String} apikey    API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       rfid: 1695694065,
 *       location: 3,
 *       apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *     }
 *
 * @apiSuccess {String} status          Status of response.
 * @apiSuccess {Object} data            User tab information.
 * @apiSuccess {String} data.uid        User's universal ID in remote db
 * @apiSuccess {String} data.pin        User's pin used to check-in
 * @apiSuccess {String} data.name       User's full name
 * @apiSuccess {String} data.shirtSize  User's shirt size
 * @apiSuccess {String} data.diet       User's dietary restrictions
 * @apiSuccess {Number} data.counter    Food counter for user.
 * @apiSuccess {Number} data.numScans   Number of scans taken for user (excluding food).
 * @apiSuccess {Boolean} data.isRepeat  Whether user is a repeat scan or not (essentially allow/deny).
 * @apiSuccess {String} message         Response Message.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status": "success",
 *       "data": {
 *         "uid": "nXNR0z8CrgT4TduIM6y0DpN6wRj1",
 *         "pin": "96",
 *         "name": "Dat Boi",
 *         "shirtSize": "M",
 *         "diet": "Vegetarian",
 *         "counter": 0,
 *         "numScans": 0,
 *         "isRepeat": false
 *       },
 *       "message": "Successfully completed task."
 *     }
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid values passed for pin"
 * @apiErrorExample {json} 404 Response
 *     HTTP/1.1 404 Not Found
 *     {
 *       status: "error",
 *       data: 0,
 *       message: "Does not exist."
 *     }
 * @apiErrorExample {json} 417 Response
 *    HTTP/1.1 417 Expectation Failed
 *    {
 *      status: 'error',
 *      data: {...},
 *      message: 'Couldn\'t find rfid'
 *    }
 *
 */
router.post('/add', helpers.ensureScannerAuthenticated, function (req, res, next) {
  if(!req.body || !req.body.location || !req.body.rfid){
    console.error("Invalid values passed for location or id");
    return res.status(401).send(new Error("Invalid values passed for location or id"));
  }

  let location = req.body.location;
  let userRFID = req.body.rfid;

  //setup sending to server asynchronously
  let scan = {
    "rfid_uid": userRFID.toString(),
    "scan_location": location.toString(),
    "scan_time": Date.now()
  };
  let options = helpers.clone(serverOptions);
  let uri = options.uri;
  options.uri = uri + '/v1/scanner/scans';
  options.method = 'POST';

  if(!redisIsConnected()){
    return res.status(500)
      .json({
        status: 'error',
        message: 'Redis database is down'
      });
  }
  //They haven't registered and it'll still go through but make a seperate location for this.
  //need to throw an error that doesn't exist
  //redis.hget(tabKey, "numProducts", function (err, reply) {
  //add to redis
  redis.exists(userRFID, function (err, val) {
    if (err) {
      return res.status(500)
        .json({
          status: 'error',
          message: 'Checking existence failed.'
        });
    } else {
      if (val === 0) {
        res.status(404)
          .json({
            status: 'error',
            data: val,
            message: 'Does not exist.'
          });
      } else {
        //rfid exists
        let incrementedKey = "numScans";
        if (location === process.env.FOOD) {
          incrementedKey = "counter";
        }
        redis.HINCRBY(userRFID, incrementedKey, 1, function (err, obj) {
          if (err) {
            res.status(500)
              .json({
                status: 'error',
                message: 'Something went wrong'
              });
          } else {
            console.log("Incrementing "+incrementedKey+" counter");
            if (obj) {
              if (incrementedKey === "numScans"){
                let numScans = parseInt(obj.toString()) - 1;
                let scanLocKey = "Scan." + numScans + ".location";
                let scanTimeKey = "Scan." + numScans + ".time";
                let data = {};
                let date = scan.scan_time;
                data[scanLocKey] = location;
                data[scanTimeKey] = date;
                redis.hmset(userRFID, data, function (err, reply) {
                  // reply is null when the key is missing
                  if (err) {
                    console.error("Failed to add scan to redis");
                  } else {
                    console.log("Added scan to redis");
                  }
                });
              }
              //return value
              console.log("Successfully added to tab!");
              redis.hgetall(userRFID, function (err, user) {
                if (err) {
                  res.status(500)
                    .json({
                      status: 'error',
                      message: 'Something went wrong'
                    });
                } else {
                  let retVal = {
                    uid: user.uid,
                    pin: user.pin,
                    name: user.name,
                    shirtSize: user.shirtSize,
                    diet: user.diet,
                    counter: user.counter,
                    numScans: user.numScans,
                    isRepeat: false
                  };
                  if (incrementedKey === "counter" && retVal.counter > 1) {
                    retVal.isRepeat = true;
                  }
                  console.dir(retVal);
                  res.status(200)
                    .json({
                      status: 'success',
                      data: retVal,
                      message: 'Incremented Tab.'
                    });
                }
              });

            } else {
              res.status(417)
                .json({
                  status: 'error',
                  data: obj,
                  message: 'Couldn\'t find rfid'
                });
            }
            //actually send to server now that we know it exists
            unsent_scans.push(scan);
            options.body = {
              scans: unsent_scans
            };
            console.log("UNSENT SCANS: " + JSON.stringify(options.body));
            //todo:worry about promises and mutli data usage
            /*
              200 if everything is success
              207 if partial failure
                - ones that succeeded will have the original scan
                - ones that failed, it will contain an error with a status code
                (409 = DUPLICATE or invalid relation) (500 for other issues)
              400 if formatting of sent info is bad
              409 if Duplicate
              500 if everything failed
             */
            request(options).then(function (response) {
              console.dir("SUCCESS: " + JSON.stringify(response));
              let newUnsent_scans = [];
              if(response.statusCode === 207){
                response.forEach(function (item) {
                  if(item instanceof Error){
                    if(item.status >= 500){
                      //bad response from server, retry scan
                      newUnsent_scans.push(item.body.scan);
                    }else if(item.status >= 400){
                      //bad request, drop from list
                      console.error(item.body.message);
                    }
                  }
                });
              }
              unsent_scans = newUnsent_scans;

            }).catch(function (err) {
              // Something bad happened, handle the error 400 and 500 errors
              console.log(err.message);
              //TODO: if duplicate entry, delete that entry otherwise everything will always fail.
              //don't delete unsent_assignments...
              if(err.statusCode >= 500){
                //bad response from server, retry scan
              }else{
                //bad request, drop from list
                unsent_scans = [];
              }
            });
          }
        });
      }
    }
  });


});


/**
 * @api {post} /tabs/getpin Get User Info with RFID tag
 * @apiVersion 1.0.0
 * @apiName GetRFID
 * @apiGroup RFID
 * @apiDescription
 * Get all user information from redis for an RFID tag if it has been assigned.
 * RFID is used to index user in redis after user has been setup.
 * @apiPermission Scanner
 *
 * @apiParam {Number} rfid      RFID code of user.
 * @apiParam {String} apikey  API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       rfid: 1695694065,
 *       apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *     }
 *
 * @apiUse UserData
 *
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid values passed for rfid"
 * @apiErrorExample {json} 404 Response
 *     HTTP/1.1 404 Not Found
 *     {
 *       status: "error",
 *       data: {},
 *       message: "Did not find anything"
 *     }
 * @apiErrorExample {json} 500 Response
 *     HTTP/1.1 500 Server Error
 *     {
 *       status: "error",
 *       message: "Redis database is down"
 *     }
 */
router.get('/user-info', helpers.ensureScannerAuthenticated, function (req, res, next) {
  if(!req.query || !req.query.rfid){
    console.error("Invalid values passed for rfid");
    return res.status(401).send(new Error("Invalid values passed for rfid"));
  }
  let userRFID = req.query.rfid;
  if(!redisIsConnected()){
      return res.status(500)
          .json({
              status: 'error',
              message: 'Redis database is down'
          });
  }
  redis.hgetall(userRFID, function (err, obj) {
    if (err) {
      res.status(404)
        .json({
          status: 'error',
          data: err,
          message: 'Does not exist or already set.'
        });
    } else {
      console.dir(obj);
      if (obj) {
        res.status(200)
          .json({
            status: 'success',
            data: obj,
            message: 'Found.'
          });
      } else {
        res.status(404)
          .json({
            status: 'error',
            data: obj,
            message: 'Did not find anything.'
          });
      }
    }
  });


});

/**
 * @api {get} /tabs/active-locations Get all Active Locations
 * @apiVersion 1.0.0
 * @apiName GetActiveLocations
 * @apiGroup RFID
 * @apiPermission Scanner
 *
 * @apiSuccess {String} status    Status of response.
 * @apiSuccess {Number} length    Length of active locations returned
 * @apiSuccess {Array} locations  Array of currently active locations
 * @apiSuccess {String} message   Response message.
 * @apiSuccessExample {json} Success Response:
 *  HTTP/1.1 200 OK
 *  {
 *    status: 'success',
 *    length: 5,
 *    locations: [
      {
        "location_name": "Cybertorium",
        "uid": 2
      },
      {
        "location_name": "Atrium",
        "uid": 5
      },
      {
        "location_name": "Business Building Room 120",
        "uid": 6
      },
      {
        "location_name": "Atrium Staircase",
        "uid": 11
      },
      {
        "location_name": "Game room",
        "uid": 15
      }
    ],
    message: 'Found active locations.'
   }
 *
 */
router.get('/active-locations', function (req, res, next) {

  let timestamp = Date.now();

  let options = helpers.clone(serverOptions);
  let uri = options.uri;
  options.uri = uri + '/v1/scanner/location';
  request(options).then(function (response) {
    //empty list of unsent scans
    console.dir("SUCCESS: " + JSON.stringify(response));
    res.status(200).json({
      status: 'success',
      locations: response,
      length: response.length,
      message: 'Found active locations.'
    });
  }).catch(function (err) {
    // Something bad happened, handle the error
    console.log(err);
    res.status(500).json({
      status: 'error',
      data: err,
      message: 'Server error.'
    });
    //do not remove unsent scans
  });


});

/*
let cursor = '0';

function scan(pattern, keys, callback) {

  redis.scan(cursor, 'MATCH', pattern, 'COUNT', '1000', function (err, reply) {
    if (err) {
      throw err;
    }
    cursor = reply[0];
    keys.push.apply(keys, reply[1]);
    if (cursor === '0') {
      return callback(keys);
    } else {

      return scan(pattern, keys, callback);
    }
  });
}*/


module.exports = router;
