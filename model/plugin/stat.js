"use strict";
const console = require('../../stdio.js').Get('model/plugin/stat', { minLevel: 'log' });	// log verbose debug
const util = require('util');
const _ = require('lodash');

module.exports = function statSchemaPlugin(schema, options) {
	options = _.defaults(options, { data: { save: {}, validate: {} } });
	if (schema._stats === undefined) {
		Object.defineProperty(schema, '_stats', { enumerable: true, writeable: true, configurable: true, value: { } });
	}
	if (!options.data) {
		throw new TypeError(`options.data must define properties for each piece of _stats data, optionally setting value to be extra/custom properties`);
	}
	_.assign(schema._stats, options.data);
	schema.on('init', model => {
		if (schema._stats !== undefined) {
			Object.defineProperty(model, '_stats', { enumerable: true, writeable: true, configurable: true, value:
				_.mapValues(schema._stats, (value, key) => _.create({
					[util.inspect.custom]: function() {
						return `{ calls: ${this.calls}, success: ${this.success}, failed: ${this.failed}, total: ${this.total},`
						 + 	` create: ${this.create}, update: ${this.update}, check: ${this.check}`
						 + 	(this.errors.length === 0 ? '' : `, errors: [\n\t` + this.errors.join('\n\t') + ' ]') + ' }';
					},
					calls: 0,												// how many raw calls to the stat thing being counted, before succeeded or failed 
					success: 0,												// how many calls to this stat succeeded 
					get failed() { return this.errors.length; },			// how many failed (counts errors)	
					get total() { return this.success + this.failed; },		// success + total (should be equal to calls, but this is another assumption/expectation to be tested)
					create: 0,
					update: 0,
					check: 0,
					errors: []
				}, value))
			});
		}
		console.debug(`schema.on('init'): model=${util.inspect(model)}`);
	});
};
