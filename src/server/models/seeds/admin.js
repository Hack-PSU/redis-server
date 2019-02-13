let passport = require('passport');
let User = require('../user');


let seedAdmin = function () {
  User.find({}, function (err, documents) {
    if (documents.length === 0) {
      let password = process.env.ADMIN_PASS;
      let user = new User({
        email: process.env.ADMIN_EMAIL,
        admin: true,
        password: password
      });
      user.generateHash(password, function (err, hash) {
        user.password = hash;
        user.save();
        console.log('Dummy admin added!');
      });
    }
  });
};

module.exports = seedAdmin;
