"use strict";
const console = require('../../stdio.js').Get('model/plugin/stat', { minLevel: 'debug' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const _ = require('lodash');
// const Q = require('q');

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

		Object.defineProperty(model, '_stats', {
			enumerable: true,
			value: {
				validate: getNewStatBasicCountsObject(),
				save: getNewStatBasicCountsObject(),
				bulkSave: getNewStatBasicCountsObject(),

				created: 0,
				updated: 0,
				checked: 0
			}
		});

		// console.debug(`stat: schema.on init: model.modelName=${model.modelName} model=${inspect(model, { depth: 0 })}\nmodel._stats=${inspect(model._stats, { depth: 4 })}\nmodel.hooks=${inspect(model.hooks, { depth: 4 })}`);
	
	});

	schema.pre('validate', function(next) {
		console.verbose(`stat: pre('validate')`);
		var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
		this.constructor._stats[actionType]++;
		this.constructor._stats.validate.calls++;
		return next();
	});
	schema.post('validate', function(doc, next) {
		console.verbose(`stat: post('validate')`);
		this.constructor._stats.validate.success++;
		return next();
	});
	schema.post('validate', function(err, doc, next) {
		console.verbose(`stat: post('validate') error: ${err.stack||err.message||err}`);
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


	schema.pre('bulkSave', function(next) {
		console.verbose(`stat: pre('bulkSave')`);
		this.constructor._stats.bulkSave.calls++;
		return next();
	});
	schema.post('bulkSave', function(doc, next) {
		console.verbose(`stat: post('bulkSave')`);
		this.constructor._stats.bulkSave.success++;
		return next();
	});
	schema.post('bulkSave', function(err, doc, next) {
		console.verbose(`stat: post('bulkSave') error: ${err.stack||err.message||err}`);
		this.constructor._stats.bulkSave.errors.push(err);
		return next(err);
	});
};
