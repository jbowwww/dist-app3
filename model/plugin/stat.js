"use strict";
const console = require('../../stdio.js').Get('model/plugin/stat', { minLevel: 'log' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: /*false*/  true  });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const _ = require('lodash');
// const Q = require('q');

//
// 181014: TODO:?? Change this to a generic model static data member plugin (not just for stats objects)?
//

	var statsInspect = ((indent = 0) => function (depth, options) {
		options = _.defaults({ compact: true }, options, { breakLength: 0 });
		// console.log(`statsInspect(depth=${depth}, options=${JSON.stringify(options)}`);
		// var r = `{ calls: ${this.calls}, success: ${this.success}, failed: ${this.failed}, total: ${this.total}, created: ${this.created}, updated: ${this.updated}, checked: ${this.checked}`;
		 // : 	'';
		//  var r = '';
		// var keys = _.keys(_.omit(this, this.errors && this.errors.length > 0 ? [] : ['errors']));//, 'calls', 'success', 'failed', 'total', 'created', 'updated', 'checked']));
		// if () keys.push('errors');
		// r += _.map(keys, k => (",\n"+" ".repeat(options.indentationLvl+1)+k+": "+
		// 	( k !== 'errors' ? util.inspect(this[k], options)
		//  : 	'[' + this.errors.length + ']' + util.inspect(_.map(this.errors, e => e.message), options /*{ compact: true }*/)))).join();
		// r += (keys.length > 0?"\n"+" ".repeat(options.indentationLvl+1):" ")+"}";
		// return r;
		return /*util.inspect*/(_.mapValues(_.omit(this, this.errors && this.errors.length > 0 ? [] : ['errors']), (v, k) => (k !== 'errors' ? v : ('['+v.length+']: '+/*util.inspect*/(v/*, options*/))))/*, options*/);
	});
	var addStatsInspect = (statsObject, indent) => _.set(statsObject, util.inspect.custom, statsInspect(indent).bind(statsObject));

function getNewStatBasicCountsObject(extra) {
	var s = /*addStatsInspect*/({
		calls: 0,												// how many raw calls to the stat thing being counted, before succeeded or failed 
		get success() { return this.created + this.updated + this.checked; },					// how many calls to this stat succeeded 
		get failed() { return this.errors.length; },			// how many failed (counts errors)	
		get total() { return this.success + this.failed; },		// success + total
		created: 0,
		updated: 0,
		checked: 0,
		errors: []
	});
	_.assign(s, _.mapValues(_.cloneDeep(extra), (k, v) => addStatsInspect(v, 1)));//, 1));///*, 1*/)));	//, (value, key) => !_.isPlainObject(value) ? value : 	//  _.set(value, util.inspect.custom, function(depth, options) { return util.inspect(_.mapValues(this, (v, k) => v), { compact: true }); })));//addStatsInspect(value, 2)));
	return addStatsInspect(s, 0);
}

module.exports = function statSchemaPlugin(schema, options) {
	// console.debug(`statSchemaPlugin(): options=${inspect(options)}, this=${inspect(this)}`);
	if (schema._stats === undefined) {
		Object.defineProperty(schema, '_stats', { enumerable: true, writeable: true, configurable: true, value: { } });
	}
	if (!options.data) {
		throw new TypeError(`options.data must define properties for each piece of _stats data, optionally setting value to be extra/custom properties`);
	}
	_.assign(schema._stats, options.data);//, (value, key) => getNewStatBasicCountsObject(options.data[key])));
console.log(`schema._stats: ${inspect(schema._stats)}`);
	schema.on('init', model => {
		if (schema._stats !== undefined) {
			Object.defineProperty(model, '_stats', { enumerable: true, writeable: true, configurable: true, value:
				_.assign({
					// get errors() {
					// 	return _.concat([], _.values(this), value => _.isPlainObject(value) && value.errors && _.isArray(value.errors) ? value.errors : []);
					// },
					// [util.inspect.custom]: statsInspect()
					[util.inspect.custom]: function(depth, options) {
						options = _.defaults({ compact: true }, options, { breakLength: 0/*88*/ });
						// console.log(`util.inspect.custom(depth=${depth}, options=${JSON.stringify(options)}`);
					// 	return /*util.*/inspect(_.mapValues(this.errors && this.errors.length > 0 ? this : _.omit(this, [ 'errors' ]), (v, k) => v), options); 
					// }
					// toString(...args) {
						// console.log(`toString(args=${inspect(args)})`);
						return util.inspect(_.mapValues(this, (v, k) => /*util.inspect*/(v/*, _.defaults({ compact: true }, options)*/)), options);///*)*/)/*, options*/);//{ compact: true, breakLength: 88 });
					}
				}, _.mapValues(schema._stats, (value, key) => getNewStatBasicCountsObject(value)))
			});
		}
		console.debug(`schema.on('init'): model=${inspect(model)}`);
	});
};
