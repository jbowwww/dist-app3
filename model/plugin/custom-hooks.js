"use strict";
const console = require('../../stdio.js').Get('model/plugin/custom-hooks.js', { minLevel: 'log' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
const { artefactDataPipe, chainPromiseFuncs } = require('../../promise-pipe.js');

/* By default, define middleware hooks for any static or instance method,
 * by overriding schema.prototype.static and schema.prototype.method
 * This behaviour can be disabled by supplying an options object as 
 * 3rd param to static() or method() with options.noCustomMiddleare = true
 */
module.exports = function customHooksSchemaPlugin(schema, options) {

	console.debug(`customHooksSchemaPlugin(): schema=${inspect(schema)}, options=${inspect(options)}, this=${inspect(this)}`);

	// const mongooseSchemaStatic = mongoose.Schema.prototype.static;//.bind(mongoose.Schema.prototype);
	_.set(schema, 'static', function mongoose_schema_static(name, fn, options = {}) {
		if (!_.isString(name)) {
			throw new TypeError('name should be a string');
		} else if (!_.isFunction(fn)) {
			throw new TypeError('fn should be a function');
		}
		// const schema = this;
		const schemaHooksExecPost = Q.denodeify(schema.s /*model*/.hooks.execPost.bind(schema.s /*model*/.hooks));
		return /*schema.static*/mongoose.Schema.prototype.static.call(schema, name,
			options.noCustomMiddleware ? fn : function /*[name]*/(...args) {
			const model = this;
			// /*return Q.when(() => */console.verbose(`[model ${model.modelName}].pre('${name}', ${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))})`);
			return /*.then(() =>*/ Q.denodeify(schema.s /*model*/.hooks.execPre.bind(schema.s.hooks))( /*model*/ name, model, args)
				.tap(result => console.verbose(`[model ${model.modelName}].pre('${name}', ${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): result=${inspect(result)}`))
				.then(() => Q(fn.apply(model, args)))
				.tap(result => console.verbose(`[model ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): result=${inspect(result)}`))
				.then(result => schemaHooksExecPost(name, model, [ result ], { error: undefined }))
				.tap(result => console.verbose(`[model ${model.modelName}].post('${name}', ${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): result=${inspect(result)}`))
				.catch(err => {
					console.warn(` ## [model ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): rejected execPost: ${err.stack||err}`);
					schemaHooksExecPost(name, model, [ null ], { error: err });
					throw err;
				});
		});
	});

	// const mongooseSchemaMethod = mongoose.Schema.prototype.method;
	_.set(schema, 'method', function mongoose_schema_method(name, fn, options = {}) {
		if (!_.isString(name)) {
			throw new TypeError('name should be a string');
		} else if (!_.isFunction(fn)) {
			throw new TypeError('fn should be a function');
		}
		// const schema = this;
		const schemaHooksExecPost = Q.denodeify(schema.s.hooks.execPost.bind(schema.s.hooks));
		return mongoose.Schema.prototype.method.call(this, name,
			options.noCustomMiddleware ? fn : function /*[name]*/(...args) {
			const doc = this;
			const model = doc.constructor;
			// return Q.when(() => 
			return /*.then(() =>*/ Q.denodeify(schema.s.hooks.execPre.bind(schema.s.hooks))(name, doc, args)
				.tap(result => console.verbose(`[doc ${model.modelName}].pre('${name}', ${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): result=${inspect(result)}`))
				.then(() => Q(fn.apply(doc, args)))
				.tap(result => console.verbose(`[doc ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): result=${inspect(result)}`))
				.then(result => schemaHooksExecPost(name, doc, [ result ], { error: undefined }))
				.tap(result => console.verbose(`[doc ${model.modelName}].post('${name}', ${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): result=${inspect(result)}`))
				.catch(e => {
					console.warn(` ## [doc ${model.modelName}].${name}(${_.join(_.map(args, arg => inspect(arg, { compact: true }), ', '))}): rejected execPost: ${e.stack||err}`);
					schemaHooksExecPost(name, doc, [ null ], { error: e });
					throw e;
				});
		});
	});

};
