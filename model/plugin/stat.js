"use strict";
const console = require('../../stdio.js').Get('model/plugin/stat', { minLevel: 'debug' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 3, compact: false /* true */ });
const util = require('util');
const _ = require('lodash');

module.exports = function statSchemaPlugin(schema, options) {

// TODO = custom inspect func that omits values of 0 and objects containing only 0's
	console.verbose(`statSchemaPlugin(): schema=${inspect(schema)}, options=${inspect(options)}, this=${inspect(this)}`);

	var discriminatorKey = schema.get('discriminatorKey');
	var model;
	// var modelInitDefer = Q.defer();
	// var modelInitPromise = modelInitDefer.promise;
	var debugPrefix;

	schema.on('init', function(_model) {
		model = _model;
		debugPrefix = `[model ${model.modelName}]`;
		console.verbose(`${debugPrefix}.on('init'): _stats=${inspect(model._stats)}`);
		// var dModel = discriminatorKey && data[discriminatorKey] && model.discriminators[data[discriminatorKey]] ? model.discriminators[data[discriminatorKey]] : model;
		// modelInitDefer.resolve(model);
	});
	
	options = _.merge({
		data: {
			instance: {
				validate: {},
				save: {},
				bulkSave: {}
			},
			static: {

			}
		}
	}, options);
	var d = options.data;

	// if (!schema._stats) {
		// Object.defineProperty(schema, '_stats', {
		// 	enumerable: true,
		// 	writeable: true,
		// 	configurable: true,
		// 	value: _.create({})
		// });
	// }
	if (!schema._stats) {
		schema._stats = {};
	}
	schema._stats = _.merge(schema._stats,
		_.isArray(d.instance)
		 ?	_.fromPairs(_.map(d.instance, name => [name, getNewDefaultStats()]))
		 :	_.mapValues(d.instance, (value, key) => _.merge(getNewDefaultStats(), value)),
		_.isArray(d.static)
		 ?	_.fromPairs(_.map(d.static, name => [name, getNewDefaultStats()]))
		 :	_.mapValues(d.static, (value, key) => _.merge(getNewDefaultStats(), value)) );
	
	_.forEach(d.instance, function(methodName) {

		console.verbose(`[doc schema].${methodName} instance middleware`);

		schema.pre(methodName, function(next) {
			var doc = this;//this instanceof mongoose.Document ? this : null;
			// var model = doc.constructor;//doc ? doc.constructor : this;
			// discriminatorKey && doc && doc[discriminatorKey] && model && model.discriminators && model.discriminators[doc[discriminatorKey]] && (model = model.discriminators[doc[discriminatorKey]]);
			var eventName = 'pre.' + methodName;
			if (model) {
				model.emit(eventName, doc);
				model._stats[methodName].calls++;
			}
			if (doc) {
				doc.emit(eventName);			// i wonder what this gets bound as? in any case shuld be the doc
				var actionType = /*doc instanceof mongoose.Document ?*/ doc.isNew ? 'create' : doc.isModified() ? 'update' : 'check' /*: 'static'*/;
				model._stats[methodName][actionType]++;
			}
			console.debug(`[doc ${model.modelName}].pre('${methodName}'): doc=${inspect(doc)} model._stats.${methodName}=${inspect(model._stats[methodName])}`);	// doc=${doc._id}  doc._actions=${inspect(doc._actions)}
			next();
		});

		schema.post(methodName, function(res, next) {
			var doc = this;//this instanceof mongoose.Document ? this : null;
			// var model = doc.constructor;//doc ? doc.constructor : this;
			// discriminatorKey && doc && doc[discriminatorKey] && model && model.discriminators && model.discriminators[doc[discriminatorKey]] && (model = model.discriminators[doc[discriminatorKey]]);
			var eventName = 'post.' + methodName;
			if (model) {
				model.emit(eventName, doc, res);
				model._stats[methodName].success++;
			}
			if (doc) {
				doc.emit(eventName, res);			// i wonder what this gets bound as? in any case shuld be the doc
			}
			console.debug(`[doc ${model.modelName}].post('${methodName}'): doc=${doc._id||doc} res=${inspect(res)} model._stats.${methodName}=${inspect(model._stats[methodName])}`);
			next();
		});

		schema.post(methodName, function(err, res, next) {
			var doc = this;//this instanceof mongoose.Document ? this : null;
			// var model = doc.constructor;//doc ? doc.constructor : this;
			// console.log(`[doc ${model.modelName}].post('${methodName}'): #1 doc.path='${doc.path}'`);
			// discriminatorKey && doc && doc[discriminatorKey] && model && model.discriminators && model.discriminators[doc[discriminatorKey]] && (model = model.discriminators[doc[discriminatorKey]]);

			// console.log(`[doc ${model.modelName}].post('${methodName}'): #2 doc.path='${doc.path}'`);
						var eventName = 'err.' + methodName;

			// console.error(`[doc ${model.modelName}].post('${methodName}') ERROR: doc=${doc._id||doc} res=${inspect(res)} model._stats.${methodName}=${inspect(model._stats[methodName])}: error: ${err.stack||err}`);
			// if (model) {
			// 	model.emit(eventName, doc, err);
				model._stats[methodName].errors.push(err);
			// }
			// if (doc) {
				doc.emit(eventName, err);			// i wonder what this gets bound as? in any case shuld be the doc
			// }
			console.error(`[doc ${model.modelName}].post('${methodName}') ERROR: doc=${doc._id||doc} res=${inspect(res)} model._stats.${methodName}=${inspect(model._stats[methodName])}: error: ${err.stack||err}`);
			return next(err);
		});

	});

	_.forEach(d.static, function(methodName) {
		
		console.verbose(`[model schema].${methodName} static middleware`);

		schema.pre(methodName, function(next) {
			// var model = this;
			var eventName = 'pre.' + methodName;
			if (model) {
				model.emit(eventName);
				model._stats[methodName].calls++;
			}
			console.debug(`[model ${model.modelName}].pre('${methodName}'): model._stats.${methodName}=${inspect(model._stats[methodName])}`);	// doc=${doc._id}  doc._actions=${inspect(doc._actions)}
			next();
		});

		schema.post(methodName, function(res, next) {
			// var model = this;
			var eventName = 'pre.' + methodName;
			if (model) {
				model.emit(eventName, res);
				model._stats[methodName].success++;
			}
			console.debug(`[model ${model.modelName}].post('${methodName}'): res=${inspect(res)} model._stats.${methodName}=${inspect(model._stats[methodName])}`);
			next();
		});

		schema.post(methodName, function(err, res, next) {
			// var model = this;
			var eventName = 'err.' + methodName;
			model.emit(eventName, res, err);
			model._stats[methodName].errors.push(err);
			console.error(`[model ${model.modelName}].post('${methodName}') ERROR: res=${inspect(res)} model._stats.${methodName}=${inspect(model._stats[methodName])}: error: ${err.stack||err}`);
			return next(err);
		});

	});

	// schema.off('init', onModelInitStats);
	// schema.on('init', onModelInitStats);

	function onModelInitStats(model) {
		// if (schema._stats !== undefined) {
			Object.defineProperty(model, '_stats', { enumerable: true, writeable: true, configurable: true, value:
				_.create({
					[util.inspect.custom]: function() { 
						return this;// _.pickBy(this, (v, k) => v.calls > 0 || v.success > 0 || v.failed > 0 || v.create > 0 || v.update > 0 || v.check > 0 || v.static > 0);
					}
				}, _.mapValues(schema._stats, (value, key) => getNewDefaultStats()))
			});

		// }
		console.debug(`schema.on('init'): modelName='${model.modelName}' model._stats=${util.inspect(model._stats)}`);
	}

	function getNewDefaultStats() {
		return _.create({
			[util.inspect.custom]: function() {
				return	this.calls === 0 && this.success === 0 && this.failed === 0 &&
						this.create === 0 && this.update === 0 && this.check === 0 && this.static === 0 ? ''
				 : 	`{ calls: ${this.calls}, success: ${this.success}, failed: ${this.failed}, total: ${this.total},`
				 + 	` create: ${this.create}, update: ${this.update}, check: ${this.check}`	// , static: ${this.static}
				 + 	(this.errors.length === 0 ? '' : `, errors: [\n\t` + this.errors.join('\n\t') + ' ]') + ' }';
			},
			calls: 0,												// how many raw calls to the stat thing being counted, before succeeded or failed 
			success: 0,												// how many calls to this stat succeeded 
			get failed() { return this.errors.length; },			// how many failed (counts errors)	
			get total() { return this.success + this.failed; },		// success + total (should be equal to calls, but this is another assumption/expectation to be tested)
			create: 0,
			update: 0,
			check: 0,
			static: 0,
			errors: []
		}/*, value*/);
	}

};
