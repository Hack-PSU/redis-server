var mongoose = require('mongoose');
const uuidv4 = require('uuid/v4');
var Schema = mongoose.Schema;


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
  }, //TODO: make a flag to see if api key has been assigned or not
  initTime: {
    type: Date,
    default: Date.now
  },
  name: {
    type: String,
    default: 'New-Scanner'
  }
});


module.exports = mongoose.model('scanners', Scanner);
