"use strict";
const console = require('../../stdio.js').Get('model/plugin/stat', { minLevel: 'verbose' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
// const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const _ = require('lodash');
// const Q = require('q');

//
// 181014: TODO:?? Change this to a generic model static data member plugin (not just for stats objects)?
//

function getNewStatBasicCountsObject(extra) {
	var statsInspect = ((indent = 0, extraKeys = []) => function (depth, options) {
		var r = '';//inspect(_.mapValues(_.omit(this, ['errors'], extraKeys), (value, propName) => this[propName]), { compact: true }) + ",\n";
		for (var key in _.keys(this)) {//extraKeys) {
			if (key == 'errors') continue;
			var value = this[key];
			var lastIsObj = isObj || false;
			var isObj = _.isPlainObject(this[key]) &&  typeof value === 'object';
			r += (lastIsObj ? '\t'.repeat(indent) : '') + key + ': ' + inspect(value) + ', ' + isObj ? '\n' : '';
		}
		// r += _.map(extraKeys, key => '' + _.isPlainObject(this[key]) ? '\n' : '' + inspect(this[key]) + _.isPlainObject(this[key]) ? '\n' : '') + ', ';
		// .join(', ').replace(/\n,\w\n/g,",\n");
	 	return !this.errors || !this.errors.length ? r
	 	 : r.substring(0, r.length - 2) + '\n' + '\t'.repeat(indent+1) + 'Errors: ' + this.errors.map(err=>err.stack).join(',\n') + '\n' + '\t'.repeat(indent) + '}';
	});
	var addStatsInspect = (statsObject, indent, extraKeys) => _.set(statsObject, util.inspect.custom, statsInspect(indent, extraKeys)/*.bind(statsObject)*/);
	var s = addStatsInspect({
		calls: 0,												// how many raw calls to the stat thing being counted, before succeeded or failed 
		success: 0,												// how many calls to this stat succeeded 
		get failed() { return this.errors.length; },			// how many failed (counts errors)	
		get total() { return this.success + this.failed; },		// success + total
		created: 0,
		updated: 0,
		checked: 0,
		errors: []
	}, 1);
	_.assign(s, _.mapValues(_.cloneDeep(extra), (value, key) => !_.isPlainObject(value) ? value : addStatsInspect(value, 2, _.keys(value))));
	return addStatsInspect(s, 0, _.keys(extra));
}

module.exports = function statSchemaPlugin(schema, options) {
	console.debug(`statSchemaPlugin(): options=${inspect(options)}, this=${inspect(this)}`);
	if (schema._stats === undefined) {
		Object.defineProperty(schema, '_stats', { enumerable: true, writeable: true, configurable: true, value: { } });
	}
	if (!options.data) {
		throw new TypeError(`options.data must define properties for each piece of _stats data, optionally setting value to be extra/custom properties`);
	}
	_.assign(schema._stats, options.data);//, (value, key) => getNewStatBasicCountsObject(options.data[key])));

	schema.on('init', model => {
		if (schema._stats !== undefined) {
			Object.defineProperty(model, '_stats', { enumerable: true, writeable: true, configurable: true, value:
				_.assign({ errors: [] }, _.mapValues(schema._stats, (value, key) => getNewStatBasicCountsObject(value)))
			});
		}
		console.debug(`schema.on('init'): model=${inspect(model)}`);
	});
};
