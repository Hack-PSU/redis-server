var express = require('express');
var moment = require('moment');
var router = express.Router();


router.get('/', function (req, res, next) {
  res.render('index', {
    user: req.user,
    message: req.flash('message')[0]
  });
});

router.get('/ping', function (req, res, next) {
  res.send("pong!");
});
router.get('/profile', function (req, res) {
  res.render('profile', {
    user: req.user,
    message: req.flash('message')[0]
  });
});

router.get('/admin', function (req, res) {

  return res.render('admin', {moment: moment, user: req.user});
});


module.exports = router;