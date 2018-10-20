"use strict";

const Q = require('q');
Q.longStackSupport = true;
var mongoose = require('mongoose');
mongoose.Promise = Q;

mongoose.connection.waitForIdle = function waitForIdle() {
	while (mongoose.connection.db.getCurrentOp() !== null) {}
};

mongoose.connection.whenIdle = function whenIdle() {
	return Q((resolve, reject) => {
		while (mongoose.connection.db.getCurrentOp() !== null) {}
		resolve();
	})
};

// mongoose.plugin(require('./model/plugin/timestamp.js'));
// mongoose.plugin(require('./model/plugin/standard.js'));
// mongoose.plugin(require('./model/plugin/bulk-save.js'));

module.exports = mongoose;
