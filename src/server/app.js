// *** main dependencies *** //
require('dotenv').load();

let express = require('express');
let path = require('path');
let morgan = require('morgan');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let session = require('express-session');
let flash = require('connect-flash');
let swig = require('swig');
let passport = require('./lib/auth');
let mongoose = require('mongoose');

//set up redis
let redis = require('./lib/redis').redis;


// *** config file *** //
let config = require('../_config');

// *** seed the database *** //
if (process.env.NODE_ENV === 'development') {
  let seedAdmin = require('./models/seeds/admin.js');
  seedAdmin();
}


// *** routes *** //
let mainRoutes = require('./routes/index');
let authRoutes = require('./routes/auth');
let rfidRoutes = require('./routes/api/rfid');
let scannerAPIRoutes = require('./routes/api/scanner');

// *** express instance *** //
let app = express();


// *** view engine *** ///
swig = new swig.Swig();
app.engine('html', swig.renderFile);
app.set('view engine', 'html');


// *** static directory *** ///
app.set('views', path.join(__dirname, './views'));


// *** config middleware *** //
if (process.env.NODE_ENV !== 'test') {
  let logger = morgan('combined');
  app.use(logger);
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(session({
  secret: process.env.SECRET_KEY || 'change_me',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());
app.use(function (req, res, next) {
  res.locals.success = req.flash('success');
  res.locals.danger = req.flash('danger');
  next();
});
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, '../', 'client')));


// *** mongo *** //
app.set('dbUrl', config.mongoURI[process.env.NODE_ENV]);
//needed to remove warnings
mongoose.set('useFindAndModify', false);
//usenewparser and usecreateindex is temporary for mongoose to update their shit
mongoose.set('useCreateIndex', true);
mongoose.connect(app.get('dbUrl'), {useNewUrlParser: true});

// *** main routes *** //
app.use('/', mainRoutes);
app.use('/auth', authRoutes);
app.use('/rfid/', rfidRoutes);
app.use('/api/v1/', scannerAPIRoutes);

// *** error handlers *** //

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    /*res.render('error', {
      message: err.message,
      error: err
    });*/
    res.status(err.status).json({
      status: "error",
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
