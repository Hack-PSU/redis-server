var express = require('express');
var router = express.Router();
var mongoose = require('mongoose-q')(require('mongoose'));
const uuidv4 = require('uuid/v4');
var passport = require('../../lib/auth');
var helpers = require('../../lib/helpers');
var Scanner = require('../../models/scanner');


// ** users ** //

// get ALL users
router.get('/scanners', helpers.ensureAdminJSON,
  function (req, res, next) {
    Scanner.findQ()
      .then(function (users) {
        return res.status(200)
          .json({
            status: 'success',
            data: users,
            message: 'Retrieved users.'
          });
      })
      .catch(function (err) {
        return next(err);
      })
      .done();
  });

// get SINGLE user
router.get('/scanners/:id', helpers.ensureAdminJSON,
  function (req, res, next) {
    Scanner.findByIdQ(req.params.id)
      .then(function (user) {
        res.status(200)
          .json({
            status: 'success',
            data: user,
            message: 'Retrieved user.'
          });
      })
      .catch(function (err) {
        return next(err);
      })
      .done();
  });

// add new scanner
router.post('/scanners', helpers.ensureAdminJSON,
  function (req, res, next) {

    let scanner = new Scanner();
    scanner.apikey = uuidv4();
    scanner.name = (new Date()).toISOString();
    // Generate 4 digit pin
    scanner.pin = Math.floor(1000 + Math.random() * 9000);
    scanner.saveQ()
      .then(function (scanner) {
        res.status(200)
          .json({
            status: 'success',
            data: scanner,
            message: 'Created user.'
          });
      })
      .catch(function (err) {
        return next(err);
      })
      .done();
  });

// update SINGLE user
router.put('/scanners/:id', helpers.ensureAdminJSON,
  function (req, res, next) {
    var id = req.params.id;
    var update = req.body;
    var options = {new: true, upsert: true};
    Scanner.findByIdAndUpdateQ(id, update, options)
      .then(function (result) {
        res.status(200)
          .json({
            status: 'success',
            data: result,
            message: 'Updated user.'
          });
      })
      .catch(function (err) {
        res.send(err);
      })
      .done();
  });

// delete SINGLE user
router.delete('/scanners/:id', helpers.ensureAdminJSON,
  function (req, res, next) {
    Scanner.findByIdAndRemoveQ(req.params.id)
      .then(function (scanner) {
        res.status(200)
          .json({
            status: 'success',
            data: scanner,
            message: 'Removed scanner.'
          });
      })
      .catch(function (err) {
        res.send(err);
      })
      .done();
  });


module.exports = router;
