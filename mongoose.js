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

mongoose.plugin(require('./model/plugin/stat.js'), {
	data: {
		save: {},
		validate: {},
		bulkSave: {}
		// 	items: {
		// 		insertOne: 0, updateOne: 0, insertMany: 0, updateMany: 0, unmodified: 0,
		// 		get total() { return this.insertOne + this.updateOne + this.insertMany + this.updateMany + this.unmodified/* + this.inserts + this.updates*/; }
		// 		// toString() { return util.inspect(this, { compact: true }); }
		// 	}
		// }
	}
});

module.exports = mongoose;
