"use strict";
const console = require('../../stdio.js').Get('model/plugin/stat', { minLevel: 'verbose' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const _ = require('lodash');
// const Q = require('q');

//171009: TODO: Either you make this usable directly on File/Dir or you alter this to set up _stats on every discriminator of the schema

module.exports = function statSchemaPlugin(schema, options) {
	
		console.debug(`statSchemaPlugin(): schema=${inspect(schema)}, options=${inspect(options)}, this=${inspect(this)}`);

	function getNewStatBasicCountsObject() {
		return {
			calls: 0,					// how many raw calls to the stat thing being counted, before succeeded or failed 
			success: 0,					// how many calls to this stat succeeded 
			get failed() { return this.errors.length; },	// how many failed (counts errors)	
			get total() { return this.success + this.failed; },		// success + total
			errors: [],										// errors
			[util.inspect.custom](depth, options) {
			 	return util.inspect(_.mapValues(
			 		_.omit(this, this.errors.length ? [] : ['errors']),
			 		(value, propName) => this[propName]),
			 	{ compact: true });
			}
		};
	}
	function getNewStatObject() {
		return {
			validate: getNewStatBasicCountsObject(),
			save: getNewStatBasicCountsObject(),
		};
	}

	schema.on('init', model => {

		// var statHolders = [ model, ..._.values(model.discriminators) ];//=> discriminator =>
		console.debug(`schema.on('init'): model.modelName=${model.modelName}`);

		_.forEach([ model /*, ..._.map(schema.childSchemas, sm => sm.model)*/ ], model => {
			Object.defineProperty(model, '_stats', {
				enumerable: true,
				value: {
					validate: getNewStatBasicCountsObject(),
					save: getNewStatBasicCountsObject(),
					bulkSave: _.extend(getNewStatBasicCountsObject(), {
						items: {
							insertOne: 0, updateOne: 0, insertMany: 0, updateMany: 0, unmodified: 0,
							get total() { return this.inserts + this.updates }
						}
					}),
					created: 0,
					updated: 0,
					checked: 0
				}
			});
			console.verbose(`model[${model.modelName?model.modelName:'none'}]._stats = ${inspect(model._stats, {compact: true})}`);
		});


		// Object.defineProperty(model.prototype, 'bulkSave', {
		// 	enumerable: true,
		// 	value: () => {
		// 		console.verbose(` ------ !!!!!!!!!! -----------\n\n---------- !!!!!!!!`);
		// 	}
		// });

		// console.debug(`stat: schema.on init: model.modelName=${model.modelName} model=${inspect(model, { depth: 0 })}\nmodel._stats=${inspect(model._stats, { depth: 4 })}\nmodel.hooks=${inspect(model.hooks, { depth: 4 })}`);
	
	});

	schema.pre('validate', function(next) {
		console.debug(`stat: pre('validate')`);//: modelName=${this.constructor.modelName} keys(this.constructor)=${_.keys(this.constructor).join(', ')} keys(this.constructor.prototype)=${_.keys(this.constructor.prototype).join(', ')}`);
		var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
		this.constructor._stats[actionType]++;
		this.constructor._stats.validate.calls++;
		return next();
	});
	schema.post('validate', function(doc, next) {
		console.debug(`stat: post('validate')`);//: modelName=${this.constructor.modelName} keys(this.constructor)=${_.keys(this.constructor).join(', ')} keys(this.constructor.prototype)=${_.keys(this.constructor.prototype).join(', ')}`);
		this.constructor._stats.validate.success++;
		return next();
	});
	schema.post('validate', function(err, doc, next) {
		console.debug(`stat: post('validate') error: ${err.stack||err.message||err}`);
		this.constructor._stats.validate.errors.push(err);
		return next(err);
	});


	schema.pre('save', function(next) {
		console.verbose(`stat: pre('save')`);
		this.constructor._stats.save.calls++;
		return next();
	});
	schema.post('save', function(doc, next) {
		console.verbose(`stat: post('save')`);
		this.constructor._stats.save.success++;
		return next();
	});
	schema.post('save', function(err, doc, next) {
		console.verbose(`stat: post('save') error: ${err.stack||err.message||err}`);
		this.constructor._stats.save.errors.push(err);
		return next(err);
	});


	// schema.pre('bulkSave', function(next) {
	// 	console.log(`stat: pre('bulkSave')`);
	// 	this.constructor._stats.bulkSave.calls++;
	// 	return next();
	// });
	// schema.post('bulkSave', function(doc, next) {
	// 	console.log(`stat: post('bulkSave')`);
	// 	this.constructor._stats.bulkSave.success++;
	// 	return next();
	// });
	// schema.post('bulkSave', function(err, doc, next) {
	// 	console.log(`stat: post('bulkSave') error: ${err.stack||err.message||err}`);
	// 	this.constructor._stats.bulkSave.errors.push(err);
	// 	return next(err);
	// });
};
