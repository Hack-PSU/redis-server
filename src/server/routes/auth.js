let express = require('express');
let router = express.Router();
let moment = require('moment');
let jwt = require('jsonwebtoken');
let redis = require('../lib/redis').redis;
let redisIsConnected = require('../lib/redis').redisIsConnected;
let serverOpt = null;
let remoteServer = require('../lib/remoteServer').then(function (serverOptions) {
  console.log("LOADED into AUTH: " + JSON.stringify(serverOptions));
  serverOpt = serverOptions;
});
let request = require("request-promise-native");
const uuidv4 = require('uuid/v4');
let passport = require('../lib/auth');
let helpers = require('../lib/helpers');
let User = require('../models/user');
let Scanner = require('../models/scanner');
const asyncMiddleware = require('../lib/asyncMiddleware');

// Middleware to require login/auth
const requireAuth = passport.authenticate('user-mobile', {session: false});
const requireLogin = passport.authenticate('user-local', {session: false});


function generateToken(user) {
  return jwt.sign(user, process.env.SECRET, {
    expiresIn: 604800 // in seconds
  });
}

router.get('/register', function (req, res, next) {
  //currently disabling registration
  //TODO: design so we can reenable registration
  return res.redirect('/auth/login');
  /*res.render('register', {
    user: req.user,
    message: req.flash('message')[0]
  });*/
});

//Register Users on website
router.post('/register', function (req, res, next) {
  let newUser = new User(req.body);
  newUser.generateHash(req.body.password, function (err, hash) {
    if (err) {
      return next(err);
    } else {
      newUser.password = hash;
      console.log(newUser);
      //save the user
      newUser.save(function (err, results) {
        if (err) {
          console.log(err);
          req.flash('message', {
            status: 'danger',
            value: 'Sorry. That email already exists. Try again.'
          });
          return res.redirect('/auth/register');
        } else {
          req.logIn(newUser, function (err) {
            if (err) {
              return next(err);
            }
            req.flash('message', {
              status: 'success',
              value: 'Successfully registered (and logged in).'
            });
            return res.redirect('/');
          });
        }
      });
    }
  });
});


router.get('/login', helpers.loginRedirect, function (req, res, next) {
  res.render('login', {
    user: req.user,
    message: req.flash('message')[0]
  });
});

router.post('/login', function (req, res, next) {
  passport.authenticate('user-local', function (err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('message', {
        status: 'danger',
        value: 'Invalid username and/or password.'
      });
      return res.redirect('/auth/login');
    }
    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }
      req.flash('message', {
        status: 'success',
        value: 'Welcome!'
      });
      //TODO: next()?? to go back to original page?
      return res.redirect('/');
    });
  })(req, res, next);
});

router.post('/authenticate', function (req, res, next) {
  passport.authenticate('user-local', function (err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      console.log("No User found");
      res.status(401).send({
        success: false,
        message: 'Invalid username and/or password.'
      });
    } else {
      console.log("User found...");
      let userInfo = helpers.setUserInfo(user);

      let token = generateToken(userInfo);
      res.status(200).json({
        success: true,
        token: 'Bearer ' + token,
        user: userInfo
      });
      /*jwt.verify(token, process.env.SECRET, function(err, data){
        console.log(err, data);
      });*/
    }
  })(req, res, next);
});

router.get('/logout', helpers.ensureAuthenticated, function (req, res) {
  req.logout();
  req.flash('message', {
    status: 'success',
    value: 'Successfully logged out.'
  });
  res.redirect('/');
});

router.get('/profile', helpers.ensureAuthenticated, function (req, res) {
  res.render('profile', {
    user: req.user,
    message: req.flash('message')[0]
  });
});

router.get('/admin', helpers.ensureAdmin, function (req, res) {
  return User.find({}, function (err, data) {
    if (err) {
      return next(err);
    } else {
      let allProducts = [];
      return res.render('admin', {data: allProducts, moment: moment, user: req.user});
    }
  });
});

router.get('/scanners', helpers.ensureAdmin, function (req, res) {
  return Scanner.find({}, function (err, scanners) {
    if (err) {
      return next(err);
    } else {
      let allScanners = scanners;
      return res.render('scanners', {data: allScanners, moment: moment, user: req.user});
    }
  });
});

/**
 * @api {post} /auth/scanner/register Register Scanner
 * @apiVersion 2.0.1
 * @apiName RegisterScanner
 * @apiGroup Admin
 * @apiDescription
 * Authenticate and register scanner on Redis-Server. This will provide an API Key in return which the scanner will use
 * for any and all requests to redis.
 * @apiPermission Admin
 *
 * @apiParam {String} pin Pin to use to prove that valid scanner is connecting to Redis. (Set valid pin in .env file)
 * @apiParamExample {json} Request Body Example
 *     {
 *       "pin": 1234
 *     }
 *
 * @apiSuccess {String} status            Status of response.
 * @apiSuccess {Object} data              User tab information.
 * @apiSuccess {Boolean} data.isAssigned  Boolean saying if apikey has been assigned to a scanner.
 * @apiSuccess {String} data.name         Auto-Generated Name for Scanner
 * @apiSuccess {String} data._id          Scanner's universal ID
 * @apiSuccess {String} data.createdAt    Date and Time that the Key was generated
 * @apiSuccess {String} data.expireAt     Date and Time that the Key will expire
 * @apiSuccess {String} data.apikey       The API key that the scanner can now use
 * @apiSuccess {String} data.pin          The pin that the scanner needs to use to get API key
 * @apiSuccess {String} message           Response Message.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       status: "success",
 *       data: {
 *         isAssigned: true,
 *         name: "2019-02-08T20:57:55.047Z",
 *         _id: "5bb170f354fd0f590ddf4103",
 *         createdAt: "2019-02-12T06:22:17.233Z",
 *         expireAt: "2019-02-15T06:23:25.971Z",
 *         apikey: "0f865521-2c05-467d-ad43-a9bac2108db9",
 *         pin: 3971
 *       },
 *       message: "Scanner Added. API Key Generated."
 *     }
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     {
 *        "status": "error",
 *        "message": "Invalid or expired pin passed.",
 *        "error": {
 *            "status": 401
 *        }
 *     }
 * @apiErrorExample {json} 500 Response
 *     HTTP/1.1 500 Server Error
 *     {
 *       status: "error",
 *       data: {err},
 *       message: "There was an error."
 *     }
 */
router.post('/scanner/register', asyncMiddleware(async function (req, res, next) {
  let pin = parseInt(req.body.pin, 10);
  if (!pin) {
    console.error("Invalid pin passed");
    let err = new Error("Invalid pin passed");
    err.status = 401;
    return next(err);
  }
  let scanner = await Scanner.findOne({ pin: pin }).exec();
  if (process.env.NODE_ENV === "test" || (scanner && !scanner.isAssigned) ){
    console.log(JSON.stringify(req.headers));
    let macAddr = req.headers.macaddr;
    if(macAddr){
      scanner.name = macAddr;
    }
    scanner.expireAt = moment().add(3, 'days');
    scanner.isAssigned = true;
    let saveRes = await scanner.save();
    return res.status(200).json({
      status: "success",
      data: scanner,
      message: "Scanner Added. API Key Generated."
    });
  }else{
    console.error("Invalid or expired pin passed.");
    let err = new Error("Invalid or expired pin passed.");
    err.status = 401;
    //remove existing scanner
    let docs = await Scanner.find({ isAssigned:false }).sort({initTime: 'descending'}).limit(1).deleteOne().exec();
    console.log(docs);
    return next(err);

  }


}));


/**
 * @api {post} /auth/scanner/verify Verify Scanner
 * @apiVersion 2.3.0
 * @apiName VerifyScanner
 * @apiGroup Admin
 * @apiDescription
 * Verify if the api key passed in is valid or not. If it isn't valid, it will return isValid=false, if it is, it will be true.
 * If apikey is close to expiring (within 2 hours), it will extend its lifespan for 3 more days.
 * @apiParam {String} apikey   API key that we want to validate is valid.
 * @apiParamExample {json} Request Body Example
 *     {
 *       "apikey": "c82532d1-e221-4977-9901-d6ac5eb91e4e"
 *     }
 *
 * @apiSuccess {String} status            Status of response.
 * @apiSuccess {Object} data              User tab information.
 * @apiSuccess {Boolean} data.isValid     Boolean saying if apikey is valid or not
 * @apiSuccess {String} data.time         Current epoch time in milliseconds
 * @apiSuccess {String} message           Response Message.
 *
 * @apiSuccessExample {json} Success-Response Valid Key:
 *     HTTP/1.1 200 OK
 *     {
 *       status: "success",
 *       data: {
 *         isValid: true,
 *         time: 1554400174029
 *       },
 *       message: "API Key data."
 *     }
 * @apiSuccessExample {json} Success-Response Invalid Key:
 *     HTTP/1.1 200 OK
 *     {
 *       status: "success",
 *       data: {
 *         isValid: false,
 *         time: 1554400175029
 *       },
 *       message: "API Key data."
 *     }
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     {
 *        "status": "error",
 *        "message": "No api key passed.",
 *        "error": {
 *            "status": 401
 *        }
 *     }
 * @apiErrorExample {json} 500 Response
 *     HTTP/1.1 500 Server Error
 *     {
 *       status: "error",
 *       data: {err},
 *       message: "There was an error."
 *     }
 */
router.post('/scanner/verify', asyncMiddleware(async function (req, res, next) {
  let apikey = req.body.apikey;
  if (!apikey) {
    console.error("No API key passed");
    let err = new Error("No API key passed");
    err.status = 401;
    return next(err);
  }
  let scanner = await Scanner.findOne({ apikey: apikey }).exec();
  let valid = false;
  if (scanner && scanner.isAssigned){
    if(moment().add(2,'hours').isAfter(scanner.expireAt)){
      scanner.expireAt = moment(scanner.expireAt).add(3, 'days');
    }
    let saveRes = await scanner.save();
    valid = true;
  }else{
    console.log("Invalid or expired apikey: " + scanner);
  }
  return res.status(200).json({
    status: "success",
    data: {
      isValid : valid,
      time: new Date().getTime()
    },
    message: "API Key data."
  });


}));

/**
 * @api {get} /auth/updatedb Update Redis DB
 * @apiVersion 2.0.0
 * @apiName UpdateRedis
 * @apiGroup Admin
 * @apiDescription
 * Update Redis Database with user information. All information will be stored with their pin as the key.
 * Users that have been assigned RFID tags will not be changed by this update.
 * @apiPermission Admin
 *
 *
 * @apiSuccess {HTML} Returns Success page
 *
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid pin passed"
 */
router.get('/updatedb', helpers.ensureAdminJSON, asyncMiddleware(async function (req, res, next) {
  if (!redisIsConnected()) {
    req.flash('message', {
      status: 'danger',
      value: 'Redis Database is down.'
    });
    return res.redirect('/auth/profile');
  }
  let options = helpers.clone(serverOpt);
  let uri = options.uri;
  options.uri = uri + '/scanner/registrations';
  try{
    let response = await request(options);
    // Request was successful, use the response object at will
    //do redis stuff then
    let numErrors = 0;
    let promises = [];
    //code to build promises to run
    response.body.data.map(function (element) {
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
              reject();
            } else {
              resolve();
            }
          });
        })
      );

    });
    options = helpers.clone(serverOpt);
    let uri = options.uri;
    options.uri = uri + '/scanner/events';
    options.qs = {filter: false};
    response = await request(options);
    response.body.data.map(function (element) {
      promises.push(new Promise(function (resolve, reject) {
          redis.hmset(element.uid, {
            "uid": element.uid,
            "event_location": element.event_location || 0,
            "event_start_time": element.event_start_time,
            "event_end_time": element.event_end_time,
            "event_title": element.event_title || "NULL",
            "event_description": element.event_description || "N/A",
            "event_type": element.event_type,
            "location_name": element.location_name

          }, function (err, reply) {
            // reply is null when the key is missing
            if (err) {
              //todo: make queue to reinsert into db
              numErrors++;
              console.log("ERROR inserting into db: " + err);
              reject();
            } else {
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
        return res.redirect('/auth/profile');
      } else {
        //success
        console.log("REDIRECTED TO SUCC");
        req.flash('message', {
          status: 'success',
          value: 'Successfully added all users to redis.'
        });
        return res.redirect('/auth/profile');
      }
    });
  }catch(err){
    // Something bad happened, handle the error
    console.log(err);
    req.flash('message', {
      status: 'danger',
      value: 'An Error Occurred.'
    });
    return res.redirect('/auth/profile');
  }


}));

//Readds everyone from server information. Recommend flushing DB before doing this.
/**
 * @api {get} /auth/reloaddb Reload Redis DB
 * @apiVersion 2.0.0
 * @apiName UpdateRedis
 * @apiGroup Admin
 * @apiDescription
 * Update Redis Database with user information. Unless user has been assigned an RFID tag,
 * all information will be stored with their pin as the key.
 * Users that have been assigned RFID tags will lose their scan data on redis.
 * @apiPermission Admin
 *
 *
 * @apiSuccess {HTML} Returns Success page
 *
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid pin passed"
 */
router.get('/reloaddb', helpers.ensureAdminJSON, function (req, res, next) {
  if (!redisIsConnected()) {
    req.flash('message', {
      status: 'danger',
      value: 'Redis Database is down.'
    });
    return res.redirect('/auth/profile');
  }
  let options = helpers.clone(serverOpt);
  let uri = options.uri;
  options.uri = uri + '/scanner/registrations';
  request(options)
    .then(function (response) {
      // Request was successful, use the response object at will
      //do redis stuff then
      let numErrors = 0;
      let promises = [];
      //code to build promises to run
      response.map(function (element) {
        console.log(element.rfid_uid);
        if(element.rfid_uid == null) {
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
          }));
        }else{
          promises.push(new Promise(function (resolve, reject) {
            //REMINDER: RFID's set like this will have no scan data for it. DO NOT RESET REDIS WHEN DOING LUNCH.
            redis.hmset(element.rfid_uid, {
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
                resolve();
              }
            });
          }));
        }

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
          return res.redirect('/auth/profile');
        } else {
          //success
          console.log("REDIRECTED TO SUCC");
          req.flash('message', {
            status: 'success',
            value: 'Successfully added all users to redis.'
          });
          return res.redirect('/auth/profile');
        }
      });


    })
    .catch(function (err) {
      // Something bad happened, handle the error
      console.log(err);
      req.flash('message', {
        status: 'danger',
        value: 'An Error Occurred.'
      });
      return res.redirect('/auth/profile');
    });


});

//DOC: Used to reset the food counter when needed for next food event

/**
 * @api {get} /auth/resetcounter Reset Counter
 * @apiVersion 2.0.0
 * @apiName ResetCounter
 * @apiGroup Admin
 * @apiDescription
 * Used to reset the food counter when needed for next food event.
 * @apiPermission Admin
 *
 *
 * @apiSuccess {HTML} SuccessFlash Returns Success page
 *
 * @apiError {HTML} ErrorFlash Returns Error Message.
 */
router.get('/resetcounter', helpers.ensureAdminJSON, function (req, res, next) {

  //this is the index number of the item we would like to remove from the tab
  if (!redisIsConnected()) {
    req.flash('message', {
      status: 'danger',
      value: 'Redis Database is down.'
    });
    return res.redirect('/auth/profile');
  }
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

//DOC: Used to reset the food counter when needed for next food event
router.get('/mobile/resetcounter', requireAuth, function (req, res, next) {

  //this is the index number of the item we would like to remove from the tab
  if (!redisIsConnected()) {
    return res.status(500)
      .json({
        status: 'error',
        message: 'Redis database is down.'
      });
  }
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

          return res.status(500)
            .json({
              status: 'error',
              message: 'Some resets in redis failed.'
            });
        } else {
          console.log("Success in setting to 0.");
          //success
          return res.status(200)
            .json({
              status: 'success',
              message: 'Successfully reset counters for all users in redis.'
            });

        }
      });

  });
});

/**
 * @api {get} /auth/removeall Empty Redis
 * @apiVersion 2.0.0
 * @apiName EmptyRedis
 * @apiGroup Admin
 * @apiDescription
 * Remove all users from Redis. Flush all information from redis.
 * @apiPermission Admin
 *
 *
 * @apiSuccess {HTML} SuccessFlash Returns Success page
 *
 * @apiError {HTML} ErrorFlash Returns Error Message.
 */
router.get('/removeall', helpers.ensureAdminJSON, function (req, res, next) {
  if (!redisIsConnected()) {
    req.flash('message', {
      status: 'danger',
      value: 'Redis Database is down.'
    });
    return res.redirect('/auth/profile');
  }
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

/**
 * @api {get} /auth/scanner/removeall Remove all Scanners
 * @apiVersion 2.0.0
 * @apiName EmptyScanners
 * @apiGroup Admin
 * @apiDescription
 * Remove all scanner objects from MongoDB. Cancels all active api keys and requires scanners to get new ones.
 * @apiPermission Admin
 *
 *
 * @apiSuccess {HTML} SuccessFlash Returns Success page
 *
 * @apiError {HTML} ErrorFlash Returns Error Message.
 */
router.get('/scanner/removeall', helpers.ensureAdminJSON, function (req, res, next) {
  Scanner.remove({}, function (err) {
    if (err) {
      console.log("ERR: " + err);

      req.flash('message', {
        status: 'danger',
        value: 'Some deletions in mongodb failed.'
      });
      return res.redirect('/auth/profile');
    } else {
      console.log("Success in setting to 0.");
      //success
      req.flash('message', {
        status: 'success',
        value: 'Successfully deleted all scanners from mongodb.'
      });
      return res.redirect('/auth/profile');
    }
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


module.exports = router;