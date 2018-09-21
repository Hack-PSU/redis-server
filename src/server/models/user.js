let mongoose = require('mongoose');
let bcrypt = require('bcryptjs');

let Schema = mongoose.Schema;
let SALT_WORK_FACTOR;

if (process.env.NODE_ENV === 'test') {
    SALT_WORK_FACTOR = 1;
} else {
    SALT_WORK_FACTOR = 10;
}

let User = new Schema({
    email: {
        type: String,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    admin: {
        type: Boolean,
        default: false
    },
    userType: {
        type: String,
        default: 'User'
    }
});

User.methods.generateHash = function(password, callback) {
    bcrypt.genSalt(10, function(err, salt) {
        if (err) {
            return next(err);
        }
        bcrypt.hash(password, salt, function(err, hash) {
            if (err) {
                return next(err);
            }
            return callback(err, hash);
        });
    });
};

User.methods.comparePassword = function(password, done) {
    bcrypt.compare(password, this.password, function(err, isMatch) {
        if (err) {
            return done(err);
        }
        return done(null, isMatch);
    });
};


module.exports = mongoose.model('users', User);
