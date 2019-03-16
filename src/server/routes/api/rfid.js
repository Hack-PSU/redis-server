/**
 * Created by PranavJain on 2/20/17.
 */
let express = require('express');
let router = express.Router({});
let passport = require('../../lib/auth');
let helpers = require('../../lib/helpers');
let redis = require('../../lib/redis').redis;
const {promisify} = require('util');
const redisAsyncGetAll = promisify(redis.hgetall).bind(redis);
const redisAsyncExists = promisify(redis.exists).bind(redis);
const redisAsyncIncrement = promisify(redis.HINCRBY).bind(redis);
const redisAsyncSet = promisify(redis.hmset).bind(redis);
let redisIsConnected = require('../../lib/redis').redisIsConnected;
let request = require("request-promise-native");

let serverOpt = null;
let remoteServer = require('../../lib/remoteServer').then(function (serverOptions) {
  console.log("LOADED: " + JSON.stringify(serverOptions));
  serverOpt = serverOptions;
});
const asyncMiddleware = require('../../lib/asyncMiddleware');
console.log(serverOpt);

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
//TODONE: move queues to redis
let unsent_scans = [];
let unsent_assignments = [];



//authorization functions
//all functions with "requireAuth" used to have helpers.ensureAuthenticated
//TODO: make this support array's of assignments recieived check the param example in doc
/**
 * @api {post} /rfid/assign Register Wristband ID to User
 * @apiVersion 2.2.0
 * @apiName Register Wristband
 * @apiGroup RFID
 * @apiDescription
 * Register Wristband to User. Sends assignment to main server, while locally replacing user key to WID code.
 * @apiPermission Scanner
 *
 * @apiParam {Number} wid  Wristband ID to set to user.
 * @apiParam {Number} pin Pin of user to add wid code to.
 * @apiParam {String} apikey API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *        assignments: {
 *          wid: "RFID1",
 *          pin: 94,
 *          apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *        }
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
 *     "Invalid values passed for wristband id or pin"
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
 *       message: 'Wristband Tag already opened.'
 *     }
 */
router.post('/assign', helpers.ensureScannerAuthenticated, function (req, res, next) {
  if(!req.body || !req.body.wid || !req.body.pin){
    console.error("Invalid values passed for wristband id or pin");
    let err = new Error("Invalid values passed for wid or pin.");
    err.status = 400;
    return next(err);
  }
  let userRFID = req.body.wid;
  //we know pin exists
  let pin = parseInt(req.body.pin, 10);

  console.log("OPENING TAB WITH USER: " + userRFID);
  console.log("WE HAVE PIN: " + pin);
  if(!redisIsConnected()){
      return res.status(500)
          .json({
              status: 'error',
              message: 'Redis database is down.'
          });
  }
  redis.hgetall(userRFID, function (err, obj) {
    if (err) {
      return res.status(500)
        .json({
          status: 'error',
          message: 'Something went wrong.'
        });
    } else {
      console.log(obj);
      if (obj) {
        return res.status(409)
          .json({
            status: 'error',
            data: obj,
            message: 'Wristband Tag already opened.'
          });
      } else {
        redis.rename(pin, userRFID, function (err, reply) {
          // returns error if couldn't find pin...
          if (err) {
            console.log("ERR Could not find pin: " + err);
            res.status(404).json({
              status: "error",
              data: err,
              message: "Invalid pin."
            });
          } else {
            console.log("Successfully set wid to tab!");
            res.status(200)
              .json({
                status: 'success',
                data: reply,
                message: 'Created tab.'
              });
            //send wid change to server asynchronously
            //get user
            redis.hgetall(userRFID, function (err, obj) {
              if (err) {
                console.log(err);
              } else {
                console.dir(obj);

                //prep request to send asynch
                let options = helpers.clone(serverOpt);
                options.method = 'POST';
                options.uri = options.uri + '/scanner/assign';
                //TODO: Normalize with other sent scans... talk to sush
                console.log("Options: " + JSON.stringify(options));
                let scan = {
                  "wid": userRFID,
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
                    (409 = DUPLICATE or invalid relation) (500 for Server Error)
                  400 if formatting of sent info is bad
                  409 if Duplicate
                  500 Server Error
                 */
                request(options).then(function (response) {
                  console.dir("SUCCESS: " + JSON.stringify(response));
                  let newUnsent_assign = [];
                  if(response.status === 207){
                    response.body.data.forEach(function (item) {
                      if(item.status !== 200){
                        if(item.status >= 500){
                          //bad response from server, retry scan
                          newUnsent_assign.push(item.body.data);
                        }else if(item.status >= 400){
                          //bad request, drop from list
                          console.error(item.body.result);
                        }
                      }
                    });
                  }
                  console.log("We are changing unset assignments" + response.status);
                  unsent_assignments = newUnsent_assign;

                }).catch(function (err) {
                  // Something bad happened, handle the error 400 and 500 errors
                  console.error( err.message);
                  //TODO: if duplicate entry, delete that entry otherwise everything will always fail.
                  //don't delete unsent_assignments...
                  if(err.statusCode >= 500 || err.message.includes("ECONNREFUSED")){
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
 * @api {post} /rfid/getpin Get User with Pin
 * @apiVersion 2.0.0
 * @apiName GetPin
 * @apiGroup RFID
 * @apiDescription
 * Get all user information from redis that hasn't been assigned an WID tag.
 * Pin is used to currently index user in redis if WID hasn't been set.
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
    let err = new Error("Invalid values passed for pin");
    err.status = 400;
    return next(err);
  }
  let pin = parseInt(req.body.pin, 10);
  console.log("PIN IS: " + pin);
    if(!redisIsConnected()){
      let err = new Error("Redis database is down");
      err.status = 500;
      return next(err);
    }
  redis.hgetall(pin, function (err, obj) {
    if (err) {
      let err = new Error("Does not exist or already set.");
      err.status = 404;
      return next(err);
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


//DOC: increment counter to tab of wid: https://redis.io/commands/hincrby
/**
 * @api {post} /rfid/scan Add User Scan
 * @apiVersion 2.0.0
 * @apiName ScanData
 * @apiGroup RFID
 * @apiDescription
 * Store and log scan location, wid tag and timestamp. Verify if user is allowed to enter, and send response back.
 * Redis will also send the scan data to the main server asynchronously. Scanners will not find out if those requests will succeed or fail.
 * @apiPermission Scanner
 *
 * @apiParam {Number} wid        Wristband ID of user.
 * @apiParam {Number} location  Location id that scan occurred at. (Set id's in admin app)
 * @apiParam {String} apikey    API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       wid: 1695694065,
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
 *      message: 'Couldn\'t find wid'
 *    }
 *
 */
router.post('/scan', helpers.ensureScannerAuthenticated, asyncMiddleware( async function (req, res, next) {
  if(!req.body || !req.body.location || !req.body.wid){
    console.error("Invalid values passed for location or id");
    let err = new Error("Invalid values passed for location or wid");
    err.status = 400;
    return next(err);
  }

  let location = req.body.location;
  let userRFID = req.body.wid;

  //setup sending to server asynchronously
  let scan = {
    "wid": userRFID.toString(),
    "scan_event": location.toString(),
    "scan_time": Date.now()
  };
  let options = helpers.clone(serverOpt);
  let uri = options.uri;
  options.uri = uri + '/scanner/scan';
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
  redis.exists(userRFID, asyncMiddleware(async function (err, val) {
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
        //check location
        let event = await redisAsyncGetAll(location);
        if (!event){
          console.error("Invalid value passed for location ");
          let err = new Error("Invalid value passed for location");
          err.status = 401;
          return next(err);
        }
        console.log(JSON.stringify(event));
        let eventType = event.event_type;
        console.log("EVENT TYPE: " + eventType);
        //wid exists
        let incrementedKey = "numScans";
        if (eventType === "food") {
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
                  message: 'WID was lost.'
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
                (409 = DUPLICATE or invalid relation) (500 for server error)
              400 if formatting of sent info is bad
              409 if Duplicate or invalid relation
              500 if Server Error
             */
            request(options).then(function (response) {
              console.dir("SUCCESS: " + JSON.stringify(response));
              let newUnsent_scans = [];
              if(response.status === 207){
                response.body.data.forEach(function (item) {
                  if(item.status !== 200){
                    if(item.status >= 500){
                      //bad response from server, retry scan
                      newUnsent_scans.push(item.body.data);
                    }else if(item.status >= 400){
                      //bad request, drop from list
                      console.error(item.body.result);
                    }
                  }
                });
              }
              unsent_scans = newUnsent_scans;

            }).catch(function (err) {
              // Something bad happened, handle the error 400 and 500 errors
              console.log(err.message);
              //if duplicate entry, delete that entry otherwise everything will always fail.
              //don't delete unsent_assignments...
              if(err.statusCode >= 500 || err.message.includes("ECONNREFUSED")){
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
  }));


}));


/**
 * @api {post} /rfid/user-info Get User Info with WID tag
 * @apiVersion 2.0.0
 * @apiName Get User
 * @apiGroup RFID
 * @apiDescription
 * Get all user information from redis for an WID tag if it has been assigned.
 * WID is used to index user in redis after user has been setup.
 * @apiPermission Scanner
 *
 * @apiParam {Number} wid      Wristband ID of user.
 * @apiParam {String} apikey  API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       wid: 1695694065,
 *       apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *     }
 *
 * @apiUse UserData
 *
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid values passed for wristband id."
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
  if(!req.query || !req.query.wid){
    console.error("Invalid values passed for wristband id.");
    let err = new Error("Invalid values passed for wristband id.");
    err.status = 400;
    return next(err);
  }
  let userRFID = req.query.wid;
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
 * @api {get} /rfid/events Get all Active Locations
 * @apiVersion 2.1.0
 * @apiName GetActiveLocations
 * @apiGroup RFID
 * @apiPermission Scanner
 *
 * @apiSuccess {String} status    Status of response.
 * @apiSuccess {Number} length    Length of active locations returned
 * @apiSuccess {Array} locations  Array of currently active locations
 * @apiSuccess {String} message   Response message.
 * @apiSuccessExample {json} Success Response:
 *   HTTP/1.1 200 OK
 *   {
      "api_response": "Success",
      "status": 200,
      "body": {
          "data": [
              {
                "uid": "00f4f6f0b02747fe86a0f239ed7ea08e",
                "event_location": 1,
                "event_start_time": 1550969885214,
                "event_end_time": 1550969885214,
                "event_title": "abcde",
                "event_description": "abcd",
                "event_type": "workshop",
                "hackathon": "84ed52ff52f84591aabe151666fae240",
                "location_name": "124 Business Building"
              },
              {...}
          ],
          "result": "Success"
      }
    }
 *
 */
router.get('/events', function (req, res, next) {

  let timestamp = Date.now();
  let options = helpers.clone(serverOpt);
  let uri = options.uri;
  options.uri = uri + '/scanner/events';
  options.qs = {filter: true};
  request(options).then(asyncMiddleware(async function (response) {
    //empty list of unsent scans
    console.dir("SUCCESS: " + JSON.stringify(response));
    res.status(200).json({
      status: 'success',
      locations: response.body.data,
      length: response.body.data.length,
      message: 'Found active locations.'
    });
    options.qs = {filter: false};
    response = await request(options);
    let multi = redis.multi();
    for(let i=0; i < response.body.data.length; i++){
      let event = response.body.data[i];
      multi.hmset(event.uid, {
        "uid": event.uid,
        "event_location": event.event_location || 0,
        "event_start_time": event.event_start_time,
        "event_end_time": event.event_end_time,
        "event_title": event.event_title || "NULL",
        "event_description": event.event_description || "N/A",
        "event_type": event.event_type,
        "location_name": event.location_name

      }, redis.print);
    }
    multi.exec(function (err, replies) {
    });
  })).catch(function (err) {
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

/**
 * @api {get} /rfid/items Get all Active Locations
 * @apiVersion 2.2.0
 * @apiName GetItems
 * @apiGroup RFID
 * @apiPermission Scanner
 *
 * @apiSuccess {String} status    Status of response.
 * @apiSuccess {Number} length    Length of active locations returned
 * @apiSuccess {Array} locations  Array of currently active locations
 * @apiSuccess {String} message   Response message.
 * @apiSuccessExample {json} Success Response:
 *   HTTP/1.1 200 OK
 *   {
      "api_response": "Success",
      "status": 200,
      "body": {
          "data": [
              {
                "uid": "00f4f6f0b02747fe86a0f239ed7ea08e",
                "event_location": 1,
                "event_start_time": 1550969885214,
                "event_end_time": 1550969885214,
                "event_title": "abcde",
                "event_description": "abcd",
                "event_type": "workshop",
                "hackathon": "84ed52ff52f84591aabe151666fae240",
                "location_name": "124 Business Building"
              },
              {...}
          ],
          "result": "Success"
      }
    }
 *
 */
router.get('/items', helpers.ensureScannerAuthenticated, function (req, res, next) {

  let options = helpers.clone(serverOpt);
  let uri = options.uri;
  options.uri = uri + '/admin/checkout/items';
  request(options).then(function (response) {
    //empty list of unsent scans
    console.dir("SUCCESS: " + JSON.stringify(response));
    res.status(200).json({
      status: 'success',
      items: response.body.data,
      length: response.body.data.length,
      message: 'Found active locations.'
    });
    let multi = redis.multi();
    for(let i=0; i < response.body.data.length; i++){
      let event = response.body.data[i];
      let key = "item-" + event.uid;
      multi.hmset(key, {
        "uid": event.uid,
        "name": event.name || "NULL",
        "quantity": event.quantity || 0
        }, redis.print);
    }
    multi.exec(function (err, replies) {
      console.log(replies); // 101, 2
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


/**
 * @api {post} /rfid/checkout Get all Active Locations
 * @apiVersion 2.2.0
 * @apiName CheckoutItem
 * @apiGroup RFID
 * @apiPermission Scanner
 *
 * @apiSuccess {String} status    Status of response.
 * @apiSuccess {Number} length    Length of active locations returned
 * @apiSuccess {Array} locations  Array of currently active locations
 * @apiSuccess {String} message   Response message.
 * @apiSuccessExample {json} Success Response:
 *   HTTP/1.1 200 OK
 *   {
      "api_response": "Success",
      "status": 200,
      "body": {
          "data": [
              {
                "uid": "00f4f6f0b02747fe86a0f239ed7ea08e",
                "event_location": 1,
                "event_start_time": 1550969885214,
                "event_end_time": 1550969885214,
                "event_title": "abcde",
                "event_description": "abcd",
                "event_type": "workshop",
                "hackathon": "84ed52ff52f84591aabe151666fae240",
                "location_name": "124 Business Building"
              },
              {...}
          ],
          "result": "Success"
      }
    }
 *
 */
router.post('/checkout', helpers.ensureScannerAuthenticated, asyncMiddleware(async function (req, res, next) {
  if(!req.body || !req.body.itemId || !req.body.wid){
    console.error("Invalid values passed for itemId or wid");
    let err = new Error("Invalid values passed for itemId or wid");
    err.status = 400;
    return next(err);
  }

  let itemId = parseInt(req.body.itemId, 10);
  let wid = req.body.wid;

  //setup sending to server asynchronously
  let scan = {
    "wid": wid.toString(),
    "itemId": itemId
  };
  let options = helpers.clone(serverOpt);
  let uri = options.uri;
  options.uri = uri + '/admin/checkout';
  options.body = scan;
  options.method = 'POST';

  if(!redisIsConnected()){
    return res.status(500)
      .json({
        status: 'error',
        message: 'Redis database is down'
      });
  }
  if((await redisAsyncExists(wid)) !== 0){
    let item = await redisAsyncGetAll("item-" + itemId);
    if (item ||  item.quantity > 0) {
      let user = await redisAsyncGetAll(wid);
      let data = {};
      let itemCount = parseInt(user[item.name], 10) || 0;
      data[item.name] = itemCount + 1;
      redisAsyncSet(wid, data);
      redisAsyncIncrement("item-" + itemId, "quantity", -1);
      res.status(200).json({
        status: 'success',
        message: 'Allowed to checkout.'
      });
    }else{
      console.error("Invalid values passed for itemId or not enough items left");
      let err = new Error("Cannot checkout that item");
      err.status = 403;
      return next(err);
    }


  }
  request(options).then(function (response) {
    //empty list of unsent scans
    console.dir("SUCCESS: " + JSON.stringify(response));

  }).catch(function (err) {
    // Something bad happened, handle the error
    console.error(err);

    //do not remove unsent scans
  });


}));



module.exports = router;
