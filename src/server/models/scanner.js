var mongoose = require('mongoose');

var Schema = mongoose.Schema;


var Scanner = new Schema({
  apikey: {
    type: String,
    required: true,
    unique: true
  },
  pin: {
    type: Number,
    required: true
  }, //TODO: make a flag to see if api key has been assigned or not
  name: {
    type: String,
    default: 'New-Scanner'
  }
});


module.exports = mongoose.model('scanners', Scanner);
