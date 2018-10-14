"use strict";

const Q = require('q');
Q.longStackSupport = true;
var mongoose = require('mongoose');
mongoose.Promise = Q;

// mongoose.plugin(require('./model/plugin/timestamp.js'));
// mongoose.plugin(require('./model/plugin/standard.js'));
// mongoose.plugin(require('./model/plugin/bulk-save.js'));

module.exports = mongoose;
