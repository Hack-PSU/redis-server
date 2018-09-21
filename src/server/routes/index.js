let express = require('express');
let moment = require('moment');
let router = express.Router();

let helpers = require('../lib/helpers');

router.get('/', function (req, res, next) {
  res.render('index', {
    user: req.user,
    message: req.flash('message')[0]
  });
});

router.get('/ping', function (req, res, next) {
  res.send("pong!");
});
router.get('/profile',helpers.ensureAdmin, function (req, res) {
  res.render('profile', {
    user: req.user,
    message: req.flash('message')[0]
  });
});

router.get('/admin', helpers.ensureAdmin, function (req, res) {

  return res.render('admin', {moment: moment, user: req.user});
});


module.exports = router;