"use strict";
const console = require('../../stdio.js').Get('model/plugin/stat', { minLevel: 'log' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const _ = require('lodash');
// const Q = require('q');

//
// 181014: TODO:?? Change this to a generic model static data member plugin (not just for stats objects)?
//

	var statsInspect = ((indent = 0) => function (depth, options) {
		// console.verbose(`statsInspect: depth=${depth} options=${JSON.stringify(options)}`);
		// var r = inspectPretty(_.mapValues(_.omit(this, ['errors']), (value, propName) => /*inspect*/(this[propName]/*, { compact: true }*/)));//.join(',\n');
	 // 	return !this.errors || !this.errors.length ? r
	 // 	 : r.substring(0, r.length - 2) + '\n' + '\t'.repeat(indent+1) + 'Errors: ' + this.errors.map(err=>err.message/*.stack*/).join(',\n') + '\n' + '\t'.repeat(indent) + '}';
		options = _.defaults(options || {}, { compact: true, indentationLvl: 1 });
		var r = options.compact ? '{ ' : "{\n"+'  '.repeat(options.indentationLvl);/*inspectPretty*/
		// 	`{ calls: ${this.calls}, success: ${this.success}, failed: ${this.failed}, total: ${this.total}, created: ${this.created}, updated: ${this.updated}, checked: ${this.checked}`;
		var keys = _.keys(_.omit(this, ['errors']));//, 'calls', 'success', 'failed', 'total', 'created', 'updated', 'checked']));
		if (this.errors && this.errors.length > 0) keys.push('errors');
		r += _.map(keys, k => (/*", "+" ".repeat(options.indentationLvl+1)+*/k+": "+
			( k !== 'errors' ? util.inspect(this[k], /*_.assign(*//*options*//*, { compact: true })*/)
		 : 	'[' + this.errors.length + ']' +
		/*util.inspect*/(_.map(this.errors, e => e.message)/*, _.assign(options, { compact: true })*/).join(",\n"))))
		.join(options.compact ? ", " : ",\n"+'  '.repeat(options.indentationLvl));
		// r += (keys.length > 0?" "+" ".repeat(options.indentationLvl+1):" ")+"}";
		r += options.compact ? ' }' : "\n"+'  '.repeat(options.indentationLvl-1)+"}";
		return r;
	});
	var addStatsInspect = (statsObject, indent) => _.set(statsObject, util.inspect.custom, statsInspect(indent).bind(statsObject));

function getNewStatBasicCountsObject(extra) {
	var s = /*addStatsInspect*/({
		calls: 0,												// how many raw calls to the stat thing being counted, before succeeded or failed 
		success: 0,												// how many calls to this stat succeeded 
		get failed() { return this.errors.length; },			// how many failed (counts errors)	
		get total() { return this.success + this.failed; },		// success + total
		created: 0,
		updated: 0,
		checked: 0,
		errors: []
	});
	_.assign(s, _.cloneDeep(extra));
		// _.mapValues(_.cloneDeep(extra), (value, key) => !_.isPlainObject(value) ? value : 
		// 	_.set(value, util.inspect.custom, function(depth, options) { return util.inspect(_.mapValues(this, (v, k) => v), { compact: false }); })));//addStatsInspect(value, 2)));
	return addStatsInspect(s, 0);
}

module.exports = function statSchemaPlugin(schema, options) {
	options = _.defaults(options, { data: { save: {}, validate: {} } });
	
	// console.debug(`statSchemaPlugin(): options=${inspect(options)}, this=${inspect(this)}`);
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
				_.assign({
					errors: [],
					[util.inspect.custom]: statsInspect()/*(depth, options) {
						return util.inspect(_.mapValues(this.errors && this.errors.length > 0 ? this : _.omit(this, [ 'errors' ]), (v, k) => v), 
					}*/
				}, _.mapValues(schema._stats, (value, key) => getNewStatBasicCountsObject(value)))
			});
		}
		console.debug(`schema.on('init'): model=${inspect(model)}`);
	});
};
