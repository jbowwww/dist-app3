"use strict";

const console = require('./stdio.js').Get('mongoose', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 1, breakLength: 0, compact: false });
const _ = require('lodash');

const Q = require('q');
console.verbose(`Q.Promise before: Q: ${inspect(Q)}\nQ.prototype: ${inspect(Q.prototype)}\nQ.Promise: ${inspect(Q.Promise)}\nQ.Promise.prototype: ${inspect(Q.Promise.prototype)}`);
Q.longStackSupport = true;
// Object.defineProperty
// /*_.assign*/ Object.defineProperty(Q/*Promise.*//*prototype*/, 'tapError', { enumerable: true, value: tapError });
// /*_.assign*/ Object.defineProperty(Q/*Promise.*/ /*prototype*/, 'mapError', { enumerable: true, value: mapError });
// _.assign Object.defineProperty(Q/*Promise.*/ .prototype, 'tapError', { enumerable: true, value: tapError });
// /*_.assign*/ Object.defineProperty(Q/*Promise.*/ .prototype, 'mapError', { enumerable: true, value: mapError });
/*_.assign*/ Object.defineProperty(Q.makePromise.prototype, 'tapError', { enumerable: true, value: tapError });
/*_.assign*/ Object.defineProperty(Q.makePromise.prototype, 'mapError', { enumerable: true, value: mapError });
/*_.assign*/ Object.defineProperty(Q.makePromise /*prototype*/, 'tapError', { enumerable: true, value: tapError });
/*_.assign*/ Object.defineProperty(Q.makePromise /*prototype*/, 'mapError', { enumerable: true, value: mapError });

function tapError(fn) { return this.catch(e => Q(fn(e)).then(() => { throw e; })); };
function mapError(fn) { return e => Q.fn(e).then(e2 => { throw e2; }); }

var _q = Q(true);
console.verbose(`Q.Promise after: ${inspect(Q.Promise)}\ntypeof _q: ${typeof _q}\n_q.prototype: ${inspect(_q.prototype)}\ntest _q: ${inspect(_q)} _q.then(): ${inspect(_q.then())}\n_q functions: ${inspect(_.functionsIn(_q))}`);

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
	const schemaHooksExecPost = Q.denodeify(schema.s /*model*/.hooks.execPost.bind(schema.s /*model*/.hooks));
	return /*schema.static*/mongooseSchemaStatic.call(this, name, function /*[name]*/(...args) {
		const model = this;
		return Q.when(() => console.verbose(`[model ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): execPre`))
		.then(() => Q.denodeify(schema.s /*model*/.hooks.execPre.bind(schema.s.hooks)) /*model*/ ( name, model)
			.then(() => Q(fn.apply(model, args)))
			.tap(result => { console.verbose(`[model ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): successful execPost: result=${inspect(result)}`); })
			.tap(result => schemaHooksExecPost(name, result, [null], { error: undefined }))
			.catch(e =>
				Q.when(() => console.warn(`[model ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): rejected execPost: ${e.stack||err}`))
				.tap(() => { schemaHooksExecPost(name, null, [null], { error: e }); throw e; })));//.reject(e)));
	});
};

const mongooseSchemaMethod = mongoose.Schema.prototype.method;
mongoose.Schema.prototype.method = function mongoose_schema_method(name, fn) {
	if (!_.isString(name)) {
		throw new TypeError('name should be a string');
	} else if (!_.isFunction(fn)) {
		throw new TypeError('fn should be a function');
	}
	const schema = this;
	const schemaHooksExecPost = Q.denodeify(schema.s.hooks.execPost.bind(schema.s.hooks));
	return mongooseSchemaMethod.call(this, name, function /*[name]*/(...args) {
		const doc = this;
		const model = doc.constructor;
		return Q.when(() => console.verbose(`[doc ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): execPre`))
		.then(() => Q.denodeify(schema.s.hooks.execPre.bind(schema.s.hooks))(name, doc)
			.then(() => Q(fn.apply(doc, args)))
			.tap(result => { console.verbose(`[doc ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): successful execPost: result=${inspect(result)}`); })
			.tap(result => schemaHooksExecPost(name, result, [null], { error: undefined }))
			.catch(e =>
				Q.when(() => console.warn(`[doc ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): rejected execPost: ${e.stack||err}`))
				.tap(() => { schemaHooksExecPost(name, null, [null], { error: e }); throw e; })));
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
