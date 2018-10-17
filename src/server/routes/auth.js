let express = require('express');
let router = express.Router();
let moment = require('moment');
let jwt = require('jsonwebtoken');
let redis = require('../lib/redis').redis;
let redisIsConnected = require('../lib/redis').redisIsConnected;
let serverOptions = require('../lib/remoteServer');
let request = require("request-promise-native");
const uuidv4 = require('uuid/v4');
let passport = require('../lib/auth');
let helpers = require('../lib/helpers');
let User = require('../models/user');
let Scanner = require('../models/scanner');

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
      //console.log(scanners);
      let allScanners = scanners;
      return res.render('scanners', {data: allScanners, moment: moment, user: req.user});
    }
  });
});

/**
 * @api {post} /auth/scanner/register Register Scanner
 * @apiVersion 1.0.0
 * @apiName RegisterScanner
 * @apiGroup Admin
 * @apiDescription
 * Authenticate and register scanner on Redis-Server. This will provide an API Key in return which the scanner will use
 * for any and all requests to redis.
 * @apiPermission None
 *
 * @apiParam {String} pin Pin to use to prove that valid scanner is connecting to Redis. (Set valid pin in .env file)
 * @apiParamExample {json} Request Body Example
 *     {
 *       pin: "MASTER_KEY"
 *     }
 *
 * @apiSuccess {String} status          Status of response.
 * @apiSuccess {Object} data            User tab information.
 * @apiSuccess {String} data.name       Auto-Generated Name for Scanner
 * @apiSuccess {String} data._id        Scanner's universal ID
 * @apiSuccess {String} data.apikey     The API key that the scanner can now use
 * @apiSuccess {String} message         Response Message.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       status: "success",
 *       data: {
 *         name: "2018-10-01T00:57:23.370Z",
 *         _id: "5bb170f354fd0f590ddf4103",
 *         apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *       },
 *       message: "Scanner Added. API Key Generated."
 *     }
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid pin passed"
 * @apiErrorExample {json} 500 Response
 *     HTTP/1.1 500 Server Error
 *     {
 *       status: "error",
 *       data: {err},
 *       message: "There was an error."
 *     }
 */
router.post('/scanner/register', function (req, res, next) {
  if (!req.body.pin || req.body.pin !== process.env.SCANNER_ADMIN_PIN) {
    console.error("Invalid pin passed");
    return res.status(401).send(new Error("Invalid pin passed"));
  }
  let pin = req.body.pin;
  let newScanner = new Scanner();
  newScanner.apikey = uuidv4();
  newScanner.name = (new Date()).toISOString();
  newScanner.save(function (err, results) {
    if (err) {
      console.log(err);
      res.status(500).json({
        status: "error",
        data: err,
        message: "There was an error."
      });
    } else {
      res.status(200).json({
        status: "success",
        data: results,
        message: "Scanner Added. API Key Generated."
      });
    }
  });
});

/**
 * @api {get} /auth/updatedb Update Redis DB
 * @apiVersion 1.0.0
 * @apiName UpdateRedis
 * @apiGroup Admin
 * @apiDescription
 * Update Redis Database with user information. All information will be stored with their pin as the key.
 * Users that have been assigned RFID tags will not be changed by this update.
 * @apiPermission None
 *
 *
 * @apiSuccess {HTML} Returns Success page
 *
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid pin passed"
 */
router.get('/updatedb', helpers.ensureAdminJSON, function (req, res, next) {
  if (!redisIsConnected()) {
    req.flash('message', {
      status: 'danger',
      value: 'Redis Database is down.'
    });
    return res.redirect('/auth/profile');
  }
  let options = helpers.clone(serverOptions);
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
        console.log(element.rfid_uid);
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

//Readds everyone from server information. Recommend flushing DB before doing this.
router.get('/reloaddb', helpers.ensureAdminJSON, function (req, res, next) {
  if (!redisIsConnected()) {
    req.flash('message', {
      status: 'danger',
      value: 'Redis Database is down.'
    });
    return res.redirect('/auth/profile');
  }
  let options = helpers.clone(serverOptions);
  let uri = options.uri;
  options.uri = uri + '/v1/scanner/registrations';
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
                console.log("Successfully opened tab with info!");
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

/*
Model.remove({}, function(err) {
   console.log('collection removed')
});
 */

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