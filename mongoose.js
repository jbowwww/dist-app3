"use strict";

const console = require('./stdio.js').Get('mongoose', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 1, breakLength: 0, compact: false });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
var mongoose = require('mongoose');
mongoose.Promise = Q;

// const mongooseConnect = mongoose.connect.bind(mongoose);
mongoose.connect = function connect(...args) {
	return /*mongooseConnect*/mongoose.Mongoose.prototype.connect.apply(this, args).then(result => {
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

const mongooseSchemaStatic = mongoose.Schema.prototype.static;//.bind(mongoose.Schema.prototype);
mongoose.Schema.prototype.static = function mongoose_schema_static(name, fn) {
	if (!_.isString(name)) {
		throw new TypeError('name should be a string');
	} else if (!_.isFunction(fn)) {
		throw new TypeError('fn should be a function');
	}
	const schema = this;
	return /*schema.static*/mongooseSchemaStatic.call(this, name, function /*[name]*/(...args) {
		const model = this;
	const schemaHooksExecPost = Q.denodeify(schema.s /*model*/.hooks.execPost.bind(schema.s /*model*/.hooks));
	return Q.when(() => console.verbose(`[model ${model.modelName}].${name}(${_.join(_.map(args => inspect(args), ', '))}): execPre`))
	.then(() => Q.denodeify(schema.s /*model*/.hooks.execPre.bind(schema.s.hooks)) /*model*/ ( name, model)
		.then(() => Q(fn.apply(model, args)))
		.tap(result => { console.verbose(`[model ${model.modelName}].${name}(${_.join(_.map(args => inspect(args), ', '))}): successful execPost: result=${inspect(result)}`); })
		.tap(result => schemaHooksExecPost(name, result, [null], { error: undefined }))
		.catch(e =>
			Q.when(() => console.warn(`[model ${model.modelName}].${name}(${_.join(_.map(args => inspect(args), ', '))}): rejected execPost: ${e.stack||err}`))
			.tap(() => { schemaHooksExecPost(name, null, [null], { error: e }); throw e; })));//.reject(e)));
	});
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
