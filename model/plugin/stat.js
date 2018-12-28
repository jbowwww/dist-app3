"use strict";
const console = require('../../stdio.js').Get('model/plugin/stat', { minLevel: 'log' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');

module.exports = function statSchemaPlugin(schema, options = {}) {

	if (_.isArray(options) && _.every(options, o => (typeof o === 'string'))) {
		options = { data: _.fromPairs(_.mapValues(options, o => ([o, {}]))) };
	} else if (_.isString(options)) {
		options = { data: { [options]: {} } };
	} else if (typeof options !== 'object') {
		throw new TypeError(`options must be an object or an array of strings`);
	}
	options = _.defaults(options, { data: { save: {}, validate: {} } });
	
	if (schema._stats === undefined) {
		Object.defineProperty(schema, '_stats', { enumerable: true, writeable: true, configurable: true, value: { } });
	}
	_.merge(schema._stats, _.mapValues(options.data, (value, key) => _.merge({
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
	}, value)));

	_.forEach(_.keys(options.data), methodName => {
		
		schema.pre(methodName, function(next) {
			var doc = this;
			var model = this.constructor;
			var eventName = 'pre.' + methodName;
			model.emit(eventName, doc);
			doc.emit(eventName);			// i wonder what this gets bound as? in any case shuld be the doc
			var actionType = this.isNew ? 'create' : this.isModified() ? 'update' : 'check';
			if (!doc._actions) {
				_.set(doc, '_actions', {});
			}
			doc._actions[methodName] = actionType;
			model._stats[methodName]/*[actionType]*/.calls++;
			model._stats[methodName][actionType]++;
			console.verbose(`[doc ${model.modelName}].pre('${methodName}'): doc=${doc._id} doc._actions=${inspect(doc._actions)} model._stats.${methodName}=${inspect(model._stats[methodName])}`);// args=${inspect(args)} ${args.length}`);
			next();
		});

		schema.post(methodName, function(/*err,*/ res, next) {
			// console.verbose(`post ${methodName}: doc=${inspect(doc)} next=${next}`);
			var doc = this;
			var model = this.constructor;
			var actionType = doc._actions[methodName];
			doc._actions[methodName] = null;
						// if (err) {
			// 	console.warn(`${debugPrefix}.post('${methodName}'): error: ${err.stack||err}`);
			// 	return model._stats[methodName][actionType].errors.push(err);				
			// }
			console.verbose(`[doc ${model.modelName}].post('${methodName}'): doc=${doc._id} res=${inspect(res)} doc._actions=${inspect(doc._actions)} model._stats.${methodName}=${inspect(model._stats[methodName])}`);// args=${inspect(args)} ${args.length}`);
			var eventName = 'post.' + methodName;
			model.emit(eventName, doc);
			doc.emit(eventName);			// i wonder what this gets bound as? in any case shuld be the doc
			model._stats[methodName]/*[actionType]*/.success++;
			next();
		});

	});

	// 181223: Note: Thinking of making all plugins responsible for their own stats object. This one will just create a model._stats object and let
	// each plugin add what they want to it.
	schema.on('init', model => {
		if (schema._stats !== undefined) {
			Object.defineProperty(model, '_stats', { enumerable: true, writeable: true, configurable: true, value: _.cloneDeep(schema._stats) });
		}
		console.debug(`stat: schema.on('init'): model._stats=${util.inspect(model._stats)}`);
	});

};
