/**
 * Created by PranavJain on 2/20/17.
 */
let express = require('express');
let router = express.Router();

let passport = require('../../lib/auth');
let helpers = require('../../lib/helpers');
let redis = require('../../lib/redis');
let request = require("request-promise-native");
let serverOptions = require('../../lib/remoteServer');
// using redis, create, edit and delete tabs
/*
{
    status: 'success',
        data: {
                            "uid": element.uid,
                            "pin": element.pin || "NULL",
                            "name": element.firstname + ' ' + element.lastname,
                            "shirtSize": element.shirt_size,
                            "diet": element.dietary_restriction || "NULL",
                            "counter": 0,
                            "numScans": 0

                        },
    message: 'Incremented Tab.'
}
*/
//todo: move queues to redis
let unsent_scans = [];
let unsent_assignments = [];

function clone(a) {
  return JSON.parse(JSON.stringify(a));
}

//Todo: set up failsafes for all methods!!!!

//authorization functions
const requireAuth = passport.authenticate('user-mobile', {session: false});
//all functions with "requireAuth" used to have helpers.ensureAuthenticated


//DOC: scan rfid and setup info
//rename Tab localhost:3000/tabs/setup/ with rfid tag
//btw we know pin exists
/* REQUEST
{
    id: <<RFID CODE>>,
    pin: <<base 10 pin>>
}
 */
/* RESPONSE
{
    status: 'success',
    data: "OK",
    message: 'Created tab.'
}
 */
/**
 * @api {get} /tabs/setup Register RFID Band to User
 * @apiVersion 1.0.0
 * @apiName Register RFID Band to User
 * @apiGroup RFID
 * @apiPermission TeamMemberPermission
 *
 * @apiParam {Number} id=Math.inf Limit to a certain number of responses
 * @apiParam {Number} offset=0 The offset to start retrieving users from. Useful for pagination
 *
 * @apiUse AuthArgumentRequired
 *
 * @apiSuccess {Array} Array of registered hackers
 */
router.post('/setup', helpers.ensureScannerAuthenticated, function (req, res, next) {
  if(!req.body.id || !req.body.pin){
    console.error("Invalid values passed for rfid or pin");
    return res.status(401).send(new Error("Invalid values passed for rfid or pin"));
  }
  let userRFID = req.body.id;
  //we know pin exists
  let pin = parseInt(req.body.pin, 10);

  console.log("OPENING TAB WITH USER: " + userRFID);
  console.log("WE HAVE PIN: " + pin);
  redis.hgetall(userRFID, function (err, obj) {
    if (err) {
      res.status(500)
        .json({
          status: 'error',
          data: err,
          message: 'Something went wrong'
        });
    } else {
      if (obj) {
        res.status(409)
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
            res.status(500).json({
              status: "error",
              data: err,
              message: "invalid pin"
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
                let options = clone(serverOptions);
                options.method = 'POST';
                options.uri = options.uri + '/v1/scanner/assignment';
                let scan = {
                  "rfid": userRFID,
                  "uid": obj.uid,
                  "time": Date.now()
                };
                unsent_assignments.push(scan);
                options.body = {
                  assignments: unsent_assignments
                };
                console.dir(unsent_assignments);
                request(options).then(function (response) {
                  console.dir("SUCCESS: " + response);
                  unsent_assignments = [];
                }).catch(function (err) {
                  // Something bad happened, handle the error
                  console.log(err);
                  //don't delete unsent_assignments...
                });
              }
            });


          }
        });
      }
    }
  });


});


//DOC: check if pin exists
/* REQUEST
{
    pin: <<base 14 pin>>
}
 */
/*RESPONSE
{
    status: 'success',
    data: {
        "uid": element.uid,
        "pin": element.pin || "NULL",
        "name": element.firstname + ' ' + element.lastname,
        "shirtSize": element.shirt_size,
        "diet": element.dietary_restriction || "NULL",
        "counter": 0,
        "numScans": 0
    },
    message: 'Some Message.'
}
*/
router.post('/getpin', helpers.ensureScannerAuthenticated, function (req, res, next) {
  if(!req.body.pin){
    console.error("Invalid values passed for pin");
    return res.status(401).send(new Error("Invalid values passed for pin"));
  }
  let pin = parseInt(req.body.pin, 10);
  console.log("PIN IS: " + pin);
  redis.hgetall(pin, function (err, obj) {
    if (err) {
      res.status(500)
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
        res.status(401)
          .json({
            status: 'error',
            data: obj,
            message: 'Did not find anything.'
          });
      }
    }
  });
});


router.get('/updatedb', helpers.ensureAdminJSON, function (req, res, next) {
  //let store = new Store({
  //    'name': req.body.name,
  //    'description': req.body.description,
  //});
  let options = clone(serverOptions);
  let uri = options.uri;
  options.uri = uri + '/v1/scanner/registrations';
  request(options)
    .then(function (response) {
      // Request was successful, use the response object at will
      //do redis stuff then
      //todo: this is being treated synchronously when it's not synchronous fix with promises
      let numErrors = 0;
      let promises = [];
      //code to build promises to run
      response.map(function (element) {
        promises.push(new Promise(function (resolve, reject) {
            redis.hmset(element.pin, {
              "uid": element.uid,
              "pin": element.pin || "NULL",
              "name": element.firstname + ' ' + element.lastname,
              "shirtSize": element.shirt_size,
              "diet": element.dietary_restriction || "NULL",
              "counter": 0,
              "numScans": 0

            }, function (err, reply) {
              // reply is null when the key is missing
              if (err) {
                //todo: make queue to reinsert into db
                numErrors++;
                console.log("ERROR inserting into db: " + err);
                resolve();
              } else {
                console.log("Successfully opened tab with info!");
                resolve();
              }
            });
          })
        );

      });

      //run promises
      Promise.all(promises).then(function () {
        //return to homepage with success flash.
        if (numErrors > 0) {
          //err
          console.log("REDIRECTED TO ERR");
          req.flash('message', {
            status: 'danger',
            value: 'Some inserts into redis failed.'
          });
          return res.redirect('/');
        } else {
          //success
          console.log("REDIRECTED TO SUCC");
          req.flash('message', {
            status: 'success',
            value: 'Successfully added all users to redis.'
          });
          return res.redirect('/');
        }
      });


    })
    .catch(function (err) {
      // Something bad happened, handle the error
      console.log(err);
      res.status(500)
        .json({
          status: 'err',
          data: err,
          message: 'Something went wrong'
        });
    });


});

//DOC: increment counter to tab of rfid: https://redis.io/commands/hincrby
//Does food count and regular workshops
/* REQUEST
{
    location: <<Identifier for which physical location the scanner is in>>,
    id: <<RFID TAG>>
}
 */
/*RESPONSE
{
    status: 'success',
    data: {
        "uid": element.uid,
        "pin": element.pin || "NULL",
        "name": element.firstname + ' ' + element.lastname,
        "shirtSize": element.shirt_size,
        "diet": element.dietary_restriction || "NULL",
        "counter": 0,
        "numScans": 0,
        "isRepeat": false/true
    },
    message: 'Incremented Tab.'
}
*/
router.post('/add', helpers.ensureScannerAuthenticated, function (req, res, next) {
  //let store = new Store({
  //    'name': req.body.name,
  //    'description': req.body.description,
  //});
  if(!req.body.location || !req.body.id){
    console.error("Invalid values passed for location or id");
    return res.status(401).send(new Error("Invalid values passed for location or id"));
  }

  let location = req.body.location;
  let userRFID = req.body.id;

  //console.log("Scanned RFID: " + userRFID + "\n with pi ID: " + location);

  //setup sending to server asynchronously
  let scan = {
    "rfid_uid": userRFID,
    "scan_location": location.toString(),
    "scan_time": Date.now()
  };
  unsent_scans.push(scan);
  let options = clone(serverOptions);
  let uri = options.uri;
  options.uri = uri + '/v1/scanner/scans';
  options.method = 'POST';
  options.body = {
    scans: unsent_scans
  };

  console.log("UNSENT SCANS: " + JSON.stringify(options));


  //They haven't registered and it'll still go through but make a seperate location for this.
  //need to throw an error that doesn't exist
  //redis.hget(tabKey, "numProducts", function (err, reply) {
  //add to redis
  redis.exists(userRFID, function (err, val) {
    if (err) {

    } else {
      if (val == 0) {
        res.status(401)
          .json({
            status: 'error',
            data: val,
            message: 'Does not exist.'
          });
      } else {
        if (location == process.env.FOOD) {
          redis.HINCRBY(userRFID, "counter", 1, function (err, obj) {
            if (err) {
              res.status(500)
                .json({
                  status: 'error',
                  data: err,
                  message: 'Something went wrong'
                });
            } else {
              //actually send to server now that we know it exists
              //todo:worry about promises and mutli data usage
              request(options).then(function (response) {
                //empty list of unsent scans
                console.dir("SUCCESS: " + response);
                unsent_scans = [];
              }).catch(function (err) {
                // Something bad happened, handle the error
                console.log(err);
                //do not remove unsent scans
              });

              console.log("Incrementing FOOD counter");
              if (obj) {
                redis.hgetall(userRFID, function (err, user) {
                  console.dir(user);
                  if (err) {
                    res.status(500)
                      .json({
                        status: 'error',
                        data: err,
                        message: 'Something went wrong'
                      });
                  } else {
                      user["isRepeat"] = false;
                    if (parseInt(obj) > 1) {
                        user.isRepeat = true;
                    }

                    res.status(200)
                      .json({
                        status: 'success',
                        data: user,
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
            }
          });
        } else {
          redis.HINCRBY(userRFID, "numScans", 1, function (err, obj) {
            if (err) {
              res.status(500)
                .json({
                  status: 'error',
                  data: err,
                  message: 'Something went wrong'
                });
            } else {
              //actually send to server now that we know it exists
              //todo:worry about promises and mutli data usage
              request(options).then(function (response) {
                //empty list of unsent scans
                console.dir("SUCCESS: " + response);
                unsent_scans = [];
              }).catch(function (err) {
                // Something bad happened, handle the error
                console.log(err);
                //do not remove unsent scans
              });

              console.log("Incrementing numScans counter");
              if (obj) {

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
                    return next(err);
                  } else {
                    console.log("Successfully added to tab!");
                    redis.hgetall(userRFID, function (err, user) {

                        user["isRepeat"] = false;
                        if (parseInt(user.counter) > 1) {
                            user.isRepeat = true;
                        }
                      console.dir(user);
                      if (user) {
                        res.status(200)
                          .json({
                            status: 'success',
                            data: user,
                            message: 'Incremented Tab.'
                          });
                      } else {
                        res.status(200)
                          .json({
                            status: 'success',
                            data: reply,
                            message: 'Incremented Tab.'
                          });
                      }
                    });

                  }
                });

              } else {
                res.status(500)
                  .json({
                    status: 'error',
                    data: obj,
                    message: 'Something went wrong'
                  });
              }
            }
          });
        }
      }
    }
  });


});

//DOC: Get user information from RFID tag
/* REQUEST
{
    id: <<RFID CODE>>
}
 */
/* RESPONSE
{
    status: 'success',
    data: {
        "uid": element.uid,
        "pin": element.pin || "NULL",
        "name": element.firstname + ' ' + element.lastname,
        "shirtSize": element.shirt_size,
        "diet": element.dietary_restriction || "NULL",
        "counter": 0,
        "numScans": 0
    },
    message: 'Retrieved tab.'
}
 */

router.get('/user-info', helpers.ensureScannerAuthenticated, function (req, res, next) {
  if(!req.query.id){
    console.error("Invalid values passed for rfid");
    return res.status(401).send(new Error("Invalid values passed for rfid"));
  }
  let userRFID = req.query.id;
  redis.hgetall(userRFID, function (err, obj) {
    if (err) {
      res.status(500)
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
        res.status(401)
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
 * @api {get} /tabs/active-locations Get all active locations
 * @apiVersion 1.0.0
 * @apiName Get all active locations
 * @apiGroup RFID
 * @apiPermission TeamMemberPermission
 *
 *
 * @apiUse AuthArgumentRequired
 *
 * @apiSuccess {Array} Array of currently active locations
 * @apiSuccessExample {json} Success-Response:
 *  HTTP/1.1 200 OK
 *  {
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
    ]
   }
 *
 */
router.get('/active-locations', function (req, res, next) {

  let timestamp = Date.now();

  let options = clone(serverOptions);
  let uri = options.uri;
  options.uri = uri + '/v1/scanner/location';
  request(options).then(function (response) {
    //empty list of unsent scans
    console.dir("SUCCESS: " + response);
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
}

//DOC: Used to reset the food counter when needed for next food event
router.get('/resetcounter', helpers.ensureAdminJSON, function (req, res, next) {

  //this is the index number of the item we would like to remove from the tab
  //test output
  let data = [];
  scan('*', data, function (keys) {
    //great
    //redis.batch().exec();
    //build 2d array of commands
    //['hset', 'key(rfid)', 'counter', '0']
    let commands = [];
    for (let i = 0; i < keys.length; i++) {
      let command = ["hset", "", "counter", "0"];
      command[1] = keys[i];
      commands.push(command);
    }

    //pass in and run the commands
    redis.batch(commands)
      .exec(function (err, replies) {
        if (err) {
          console.log("ERR: " + err);

          req.flash('message', {
            status: 'danger',
            value: 'Some resets in redis failed.'
          });
          return res.redirect('/auth/profile');
        } else {
          console.log("Success in setting to 0.");
          //success
          req.flash('message', {
            status: 'success',
            value: 'Successfully reset counters for all users in redis.'
          });
          return res.redirect('/auth/profile');

        }
      });

  });


});

router.get('/removeall', helpers.ensureAdminJSON, function (req, res, next) {

    redis.flushdb(function (err, success) {
        if (err) {
            console.log("ERR: " + err);

            req.flash('message', {
                status: 'danger',
                value: 'Some deletions in redis failed.'
            });
            return res.redirect('/auth/profile');
        } else {
            console.log("Success in setting to 0.");
            //success
            req.flash('message', {
                status: 'success',
                value: 'Successfully deleted all users in redis.'
            });
            return res.redirect('/auth/profile');
        }
    });
});

module.exports = router;
