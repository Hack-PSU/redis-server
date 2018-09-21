let express = require('express');
let router = express.Router();
let moment = require('moment');
let jwt = require('jsonwebtoken');

const uuidv4 = require('uuid/v4');
let passport = require('../lib/auth');
let helpers = require('../lib/helpers');
let User = require('../models/user');
let Scanner = require('../models/scanner');

// Middleware to require login/auth
const requireAuth = passport.authenticate('user-mobile', { session: false });
const requireLogin = passport.authenticate('user-local', { session: false });


function generateToken(user) {
    return jwt.sign(user, process.env.SECRET, {
        expiresIn: 604800 // in seconds
    });
}

router.get('/register', function(req, res, next){
  //currently disabling registration
  //TODO: design so we can reenable registration
  return res.redirect('/auth/login');
  /*res.render('register', {
    user: req.user,
    message: req.flash('message')[0]
  });*/
});

//Register Users on website
router.post('/register', function(req, res, next) {
    let newUser = new User(req.body);
    newUser.generateHash(req.body.password, function(err, hash) {
        if (err) {
            return next(err);
        } else {
            newUser.password = hash;
            console.log(newUser);
            //save the user
            newUser.save(function(err, results) {
                if (err) {
                    console.log(err);
                    req.flash('message', {
                        status: 'danger',
                        value: 'Sorry. That email already exists. Try again.'
                    });
                    return res.redirect('/auth/register');
                } else {
                    req.logIn(newUser, function(err) {
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

router.post('/register-scanner', function(req, res, next) {
  if(!req.body.pin){
    console.error("Invalid pin passed");
    return res.status(400).send(new Error("Invalid pin passed"));
  }
  let pin = req.body.pin;
  let name = req.body.name;
  let newScanner = new Scanner();
  newScanner.apikey = uuidv4();
  newScanner.name = name || "New-Scanner";
  //TODO: check if api key already exists
  console.log("THE PIN IS: " + pin);
  newScanner.save(function(err, results) {
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

router.get('/login', helpers.loginRedirect, function(req, res, next){
  res.render('login', {
    user: req.user,
    message: req.flash('message')[0]
  });
});

router.post('/login', function(req, res, next) {
  passport.authenticate('user-local', function(err, user, info) {
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
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      req.flash('message', {
        status: 'success',
        value: 'Welcome!'
      });
      return res.redirect('/');
    });
  })(req, res, next);
});
router.post('/authenticate', function(req, res, next) {
    passport.authenticate('user-local', function(err, user, info) {
        if (err) {
            return next(err);
        }
        if (!user) {
            console.log("No User found");
            res.status(401).send({
                success: false,
                message: 'Invalid username and/or password.'
            });
        }else{
            console.log("User found...");
            let userInfo = helpers.setUserInfo(user);

            let token = generateToken(userInfo);
            res.status(200).json({
                success: true,
                token: 'JWT ' + token,
                user: userInfo
            });
        }
    })(req, res, next);
});

router.get('/logout', helpers.ensureAuthenticated, function(req, res){
  req.logout();
  req.flash('message', {
    status: 'success',
    value: 'Successfully logged out.'
  });
  res.redirect('/');
});

router.get('/profile', helpers.ensureAuthenticated, function(req, res){
  res.render('profile', {
    user: req.user,
    message: req.flash('message')[0]
  });
});

router.get('/admin', helpers.ensureAdmin, function(req, res){
  return User.find({}, function(err, data) {
    if (err) {
      return next(err);
    } else {
      let allProducts = [];
      return res.render('admin', {data: allProducts, moment: moment, user: req.user});
    }
  });
});


module.exports = router;