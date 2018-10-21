"use strict";

const console = require('./stdio.js').Get('mongoose', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 1, breakLength: 0, compact: false });

const Q = require('q');
Q.longStackSupport = true;
var mongoose = require('mongoose');
mongoose.Promise = Q;

const mongooseConnect = mongoose.connect.bind(mongoose);
mongoose.connect = function connect(...args) {
	return mongooseConnect(...args).then(result => {
		console.verbose(`mongoose.connect.then: args=${inspect(args)} result=${inspect(result)}`);
		return result;
	});
};

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
