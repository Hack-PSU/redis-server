let passport = require('passport');
let LocalStrategy = require('passport-local');
//let OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
//const BasicStrategy = require('passport-http').BasicStrategy;
let JwtStrategy = require('passport-jwt').Strategy;
let ExtractJwt = require('passport-jwt').ExtractJwt;
let APIKeyStrategy = require('passport-localapikey').Strategy;
let User = require('../models/user');
let Scanner = require('../models/scanner');

// http://stackoverflow.com/a/21898892
//todo: get this to work with OAuth 2 check passportjs docs
//todo: very they're admin
passport.use('user-local', new LocalStrategy({
    usernameField: 'email',
    passReqToCallback: true
  },
  function (req, email, password, done) {
    User.findOne({email: email}, function (err, user) {
      if (err) {
        return done(err);
      }
      if (!user) {
        return done(null, false);
      }
      user.comparePassword(password, function (err, isMatch) {
        if (err) {
          return done(err);
        }
        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      });
    });
  })
);
passport.use('user-mobile', new JwtStrategy({
    // Telling Passport to check authorization headers for JWT
    jwtFromRequest: ExtractJwt.fromAuthHeader(),
    // Telling Passport where to find the secret
    secretOrKey: process.env.SECRET
  },
  function (payload, done) {
    //console.log("Testing User-Mobile auth flow:  \nPayload: " + JSON.stringify(payload));
    //todo: this wont work since we've commented this out.
    /*User.findOne({ email: payload.email }, function(err, user) {
        if (err) {
            return done(err);
        }
        if (!user) {
            return done(null, false);
        }else{

            return done(null, user);
        }
    });*/
    return done(err);
  }
));
passport.use('scanner-api', new APIKeyStrategy(
  function (apikey, done) {
    Scanner.findOne({apikey: apikey}, function (err, scanner) {
      if (err) {
        return done(err);
      }
      if (!scanner) {
        return done(null, false);
      }
      return done(null, scanner);
    });
  }
));


//fix these to work with both models
passport.serializeUser(function (user, done) {

  done(null, user.id);
});

passport.deserializeUser(function (key, done) {
  User.findById(key, function (err, user) {
    if (!err) {
      done(null, user);
    } else {
      done(err, null);
    }
  });
});

module.exports = passport;