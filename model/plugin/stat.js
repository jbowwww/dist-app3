"use strict";
const console = require('../../stdio.js').Get('model/plugin/stat', { minLevel: 'log' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const _ = require('lodash');
// const Q = require('q');

//171009: TODO: Either you make this usable directly on File/Dir or you alter this to set up _stats on every discriminator of the schema

module.exports = function statSchemaPlugin(schema, options) {
	
	console.verbose(`statSchemaPlugin(): schema=${inspect(schema)}, options=${inspect(options)}, this=${inspect(this)}`);

	function getNewStatBasicCountsObject(extra) {
		var statsInspect = function (depth, options) {
		 	return inspect(_.mapValues(
		 		_.omit(this, this.errors && this.errors.length ? [] : ['errors']),
		 		(value, propName) => this[propName]),
		 	{ compact: true });
		};
		var addStatsInspect = (statsObject) => _.set(statsObject, util.inspect.custom, statsInspect);
		var s = addStatsInspect({
			calls: 0,					// how many raw calls to the stat thing being counted, before succeeded or failed 
			success: 0,					// how many calls to this stat succeeded 
			get failed() { return this.errors.length; },	// how many failed (counts errors)	
			get total() { return this.success + this.failed; },		// success + total
			created: 0,
			updated: 0,
			checked: 0,
			errors: []
		});
		_.assign(s, _.mapValues(extra, (value, key) => !_.isPlainObject(value) ? value : addStatsInspect(value)));
		return s;
	}

	schema.on('init', model => {
		Object.defineProperty(model, '_stats', {
			enumerable: true,
			value: {
				validate: getNewStatBasicCountsObject(),
				save: getNewStatBasicCountsObject(),
				bulkSave: getNewStatBasicCountsObject({
					items: {
						insertOne: 0, updateOne: 0, insertMany: 0, updateMany: 0, unmodified: 0,
						get total() { return this.insertOne + this.updateOne + this.insertMany + this.updateMany + this.unmodified/* + this.inserts + this.updates*/; }
					}
				})
			}
		});
		console.verbose(`schema.on('init'): model=${inspect(model)}`);
	});

	schema.pre('validate', function(next) {
		console.debug(`stat: pre('validate')`);//: modelName=${this.constructor.modelName} keys(this.constructor)=${_.keys(this.constructor).join(', ')} keys(this.constructor.prototype)=${_.keys(this.constructor.prototype).join(', ')}`);
		var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
		this.constructor._stats.validate[actionType]++;
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
		console.debug(`stat: pre('save')`);
		var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
		this.constructor._stats.save[actionType]++;
		this.constructor._stats.save.calls++;
		return next();
	});
	schema.post('save', function(doc, next) {
		console.debug(`stat: post('save')`);
		this.constructor._stats.save.success++;
		return next();
	});
	schema.post('save', function(err, doc, next) {
		console.debug(`stat: post('save') error: ${err.stack||err.message||err}`);
		this.constructor._stats.save.errors.push(err);
		return next(err);
	});
};
