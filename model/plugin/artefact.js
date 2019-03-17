
const console = require('../../stdio.js').Get('model/plugin/artefact', { minLevel: 'debug' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 3, compact: false /* true */ });
const util = require('util');
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
const { /*promisePipe,*/ artefactDataPipe, chainPromiseFuncs, iff, tap } = require('../../promise-pipe.js');

/* Standard/common schema methods, statics
 */
module.exports = function artefactSchemaPlugin(schema, options) {

	console.debug(`artefactSchemaPlugin(): schema=${inspect(schema)}, options=${inspect(options)}, this=${inspect(this)}`);
	
	schema.add({
		// _artefact: { type: mongoose.SchemaTypes.Mixed, required: false, default: undefined },
		_primary: { type: mongoose.SchemaTypes.ObjectId, refPath: '_primaryType', required: false, default: undefined },
		_primaryType: { type: String, required: false/*true*/, default: undefined }
	});
	// schema.virtual('_artefact');

	/* Find a _meta document from the given model(table)
	 * */
	schema.method('getArtefact', function getArtefact(options = {}) {
		
		var doc = this;
		var dk = schema.get('discriminatorKey');
		// var oldModel = this.constructor;
		var model = this.constructor; //dk && typeof dk === 'string' && dk.length>0 && doc[dk] && oldModel.discriminators[doc[dk]] ? oldModel.discriminators[doc[dk]] : oldModel;
		var modelName = model.modelName;
		doc._primary = doc;
		doc._primaryType = modelName;

		function doMetaPipe(meta, promisePipe) {
			if (!promisePipe) {
				return Q(meta);
			}
			if (_.isArray(promisePipe)) {
				promisePipe = chainPromiseFuncs(promisePipe);
			} else if (typeof promisePipe !== 'function') {
				throw new TypeError(`doMetaPipe: promisePipe should be a function or array, but is a ${typeof promisePipe}`);
			}
			return Q(promisePipe(meta));
		}

		var a = Object.create({
			
			// get _primaryDataType() { return modelName; },
			// get _primaryDataId() { return doc._id; },
			// get _primaryData() { return doc; },

			// get [modelName]() { return doc; },
			
			[util.inspect.custom](depth, options) {
				return _.mapValues(this, (v, k) => v instanceof mongoose.Document ? v.toObject({ getters: true }) : v);
			},

			save(opts) {
				opts = _.assign({
					maxBatchSize: 10,
					batchTimeout: 750
				}, opts);
				console.debug(`Artefact.save(opts=${inspect(opts, { compact: true })}: ${inspect(this, { compact: false })}`);
				return Q.all(
					_.map(this, (data, dataName) => data.save(opts.meta && opts.meta[dataName] ? opts.meta[dataName] : opts))
				)
				.then(() => this);
			},

			bulkSave(opts) {
				opts = _.assign({
					maxBatchSize: 10,
					batchTimeout: 750
				}, opts);
				console.debug(`Artefact.bulkSave(opts=${inspect(opts, { compact: true })}: ${inspect(this, { compact: false })}`);
				return Q.all(
					_.map(this, (data, dataName) => data.bulkSave(opts.meta && opts.meta[dataName] ? opts.meta[dataName] : opts))
				)
				.then(() => this);
			},

			addMetaData(modelName, data, promisePipe) {
				if (typeof modelName !== 'string') throw new TypeError('modelName must be a string');
				console.debug(`Artefact.addMetaData('${modelName}'): this=${inspect(this, { compact: false })}`);
				if (this[modelName]) {
					console.debug(`Artefact.addMetaData('${modelName}'): meta exists: ${inspect(this[modelName], { compact: false })}`);
					return Q(this);
				} else {
					var model = mongoose.model(modelName);
					if (!model) throw new Error(`model '${modelName}' does not exist`);
					return model.construct(_.assign({ /*_artefact: a,*/ _primary: doc, _primaryType: modelName }, data))
					.then(meta => doMetaPipe(meta, promisePipe))
					.tap(meta => console.debug(`Artefact.addMetaData('${modelName}'): this=${inspect(this, { compact: false })}, meta=${inspect(meta, { compact: false })}`))
					.then(meta => Object.defineProperty(this, modelName, { writeable: true, enumerable: true, value: meta }));
				}
			},

			addOrFindMetaData(modelName, data, promisePipe) {
				var model = mongoose.model(modelName);
				return model.findOrCreate(_.assign({ /*_artefact: a,*/ _primary: doc, _primaryType: modelName }, data))
				.then(meta => doMetaPipe(meta, promisePipe))
				.tap(meta => console.debug(`getArtefact: modelName=${modelName} modelName='${modelName}': model=${model.count()} meta=${inspect(meta, { compact: false })}, promisePipe: ${promisePipe?'yes':'no'}`))
				.then(meta => Object.defineProperty(this, modelName, { writeable: true, enumerable: true, value: meta }));
			},

			findMetaData(modelName, promisePipe) {
				var model = mongoose.model(modelName);
				return model.findOne({ _primary: doc, _primaryType: modelName })
				.then(meta => iff(meta, 
					meta => doMetaPipe(meta, promisePipe),
					tap(meta => console.debug(`getArtefact: modelName=${modelName} modelName='${modelName}': model=${model.count()} meta=${!meta?'(null)':inspect(meta, { compact: false })}`)),
					meta => Object.defineProperty(this, modelName, { writeable: true, enumerable: true, value: meta })));
			}

		}, {
			// _primaryDataType: { enumerable: true, value: modelName },
			// _primaryDataId: doc._id,
			[model.baseModelName]: { writeable: true, enumerable: false, value: doc }, 
			[modelName]: { writeable: true, enumerable: true, value: doc }
			// [util.inspect.custom](depth, options): { return }
		});
		// doc._artefact = a;

		var allModels = options.meta ? _.keys(options.meta) :
			_.filter(mongoose.modelNames(), modelName => {
				var m = mongoose.model(modelName);
				return m.discriminators === undefined && model.baseModelName != m.baseModelName && model.modelName != m.baseModelName && model.baseModelName != m.modelName;
			});
		
		console.debug(`[model ${modelName}(dk=${dk})].getArtefact(): a=${inspect(/*_.clone*/(a), { depth: 5, compact: false })} allModels=${allModels.join(', ')} options=${inspect(options)}`);

		return Q.all(_.map(allModels, modelName => a[modelName] ? Q(a[modelName]) : a.findMetaData(modelName, options.meta ? options.meta[modelName] : undefined)))
		.then(() => { console.debug(`getArtefact: modelName=${modelName} allModels=[ ${allModels.map(mn=>`'${mn}'`).join(', ')} ] a=${inspect(a, { compact: false })}`); })
		.then(() => Q(a));	
	});

	schema.query.getArtefacts = function getArtefacts(...args) {
		var model = this;
		var cursor = this.cursor({ transform: fs => Artefact(fs) });
		Object.defineProperty(cursor, 'promisePipe', { enumerable: true, value: function cursorPromisePipe(...args) {
			var fns = [];
			var options = null;
			_.forEach(args, (arg, i) => {
				if (typeof arg === 'object') {
					if (fns.length > 0 || options !== null) {
						throw new TypeError(`findArtefacts: object after functions`);
					}
					options = arg;
				} else if (typeof arg === 'function') {
					fns.push(arg);
				} else {
					throw new TypeError(`findArtefacts: args must be [object], [...functions]`);
				} 
			});
			options = _.defaults(options, { concurrency: 8 });
			console.debug(`[model ${modelName}].getArtefacts().promisePipe(): options=${inspect(options, { compact: true })} cursor=${inspect(cursor, { compact: false })}`);
			return promisePipe(cursor, options, ...fns);
		}});
		console.debug(`[model ${modelName}].getArtefacts(): options=${inspect(options, { compact: true })} cursor=${inspect(cursor, { compact: false })}`);
		return cursor;
	};

	schema.method('isCheckedSince', function isCheckedSince(timestamp) {
		if (!_.isDate(timestamp)) {
			throw new TypeError(`isCheckedSince: timestamp must be a Date`);
		}
		return !this.isNew && this._ts.checkedAt > timestamp;
	});

};
