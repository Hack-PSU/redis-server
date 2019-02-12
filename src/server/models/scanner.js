var mongoose = require('mongoose');
const uuidv4 = require('uuid/v4');
let moment = require('moment');
var Schema = mongoose.Schema;

//NOTE: The MongoDB expiry reaper only runs once a minute. So the Scanner might stay inside the DB for up to 60 seconds longer than it should
var Scanner = new Schema({
  apikey: {
    type: String,
    required: true,
    default: uuidv4,
    unique: true
  },
  pin: {
    type: Number,
    required: true,
    unique: true
  },
  isAssigned: {
    type: Boolean,
    required: true,
    default: false
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  expireAt: {
    type: Date,
    required: true,
    default: function() {
      // 5 minutes from now.
      return moment().add(5, "minutes");
    }
  },
  name: {
    type: String,
    default: 'New-Scanner'
  }
});

// Expire at the time indicated by the expireAt field
Scanner.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('scanners', Scanner);
