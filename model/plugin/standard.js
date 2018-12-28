"use strict";
const console = require('../../stdio.js').Get('model/plugin/standard', { minLevel: 'log' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
const { promisePipe, artefactDataPipe, chainPromiseFuncs } = require('../../promise-pipe.js');
const statPlugin = require('./stat.js');
const Artefact = require('../../Artefact.js');

const trackedMethods = ['validate', 'save'/*, 'bulkSave', 'find'*/];

/* Standard/common schema methods, statics
 */
module.exports = function standardSchemaPlugin(schema, options) {
	
	schema.plugin(statPlugin, trackedMethods);

/*
	schema.pre('validate', function(next) {
		var model = this.constructor;
		
	var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
	// 	
			this.constructor._stats.validate.calls++;
		return next();
	});
	schema.post('validate', function(doc, next) {
		var model = this.constructor;
		console.debug(`stat: [model ${model.modelName}].post('validate'): id=${this._id.toString()}`);//: modelName=${this.constructor.modelName} keys(this.constructor)=${_.keys(this.constructor).join(', ')} keys(this.constructor.prototype)=${_.keys(this.constructor.prototype).join(', ')}`);
		this.constructor._stats.validate.success++;
		return next();
	});
			this.constructor._stats[methodName].validate[actionType]++;	// schema.post('validate', function(err, doc, next) 
	{
		var model = this.constructor;
		console.error(`stat: [model ${model.modelName}].post('validate') error: id=${this._id.toString()}: ${err.stack||err.message||err}`);
		this.constructor._stats.validate.errors.push(err);
		return next(err);
	});

	schema.pre('save', function(next) {
		var model = this.constructor;
		var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
		console.debug(`stat: [model ${model.modelName}].pre('save'): actionType=${actionType} id=${this._id.toString()}`);
		this.constructor._stats.save[actionType]++;
		this.constructor._stats.save.calls++;
		return next();
	});
	schema.post('save', function(doc, next) {
		var model = this.constructor;
		console.debug(`stat: [model ${model.modelName}].post('save'): id=${this._id.toString()}`);
		this.constructor._stats.save.success++;
		return next();
	});
	schema.post('save', function(err, doc, next) {
		var model = this.constructor;
		console.error(`stat: [model ${model.modelName}].post('save') error: id=${this._id.toString()}: ${err.stack||err.message||err}`);
		this.constructor._stats.save.errors.push(err);
		return next(err);
	});

	schema.pre('construct', function(next) {
		var model = this;
		console.debug(`stat: [model ${model.modelName}].pre('construct'): next=${typeof next}`);// args=${inspect(args)} ${args.length}`);
		return next();
	});
	schema.post('construct', function(doc, next) {
		var model = this;
		console.debug(`stat: [model ${model.modelName}].post('construct'): doc=${inspect(doc)}`);
		return next();
	});
	schema.post('construct', function(err, doc, next) {
		var model = this;//.constructor;
		console.error(`stat: [model ${model.modelName}].post('construct') error: id=${doc && doc._id ? doc._id.toString() : '(null)'}: ${err.stack||err}`);
		model._stats.errors.push(err);
		return next(err);
	});
*/


// would use a regex to match everything but i can't see any way to then get the actual event name??
//add more as they become useful. I'm not sure save/bulkSave are very useful because of mongoose not firing middleware from it's bulkSave and me doing it custom
	// _.forEach(trackedMethods, methodName => {
		
		// schema.pre(methodName, function(next) {
		// 	var doc = this;
		// 	var model = this.constructor;
		// 	var eventName = 'pre.' + methodName;
		// 	model.emit(eventName, doc);
		// 	doc.emit(eventName);			// i wonder what this gets bound as? in any case shuld be the doc
		// 	var actionType = this.isNew ? 'create' : this.isModified() ? 'update' : 'check';
		// 	if (!doc._actions) {
		// 		_.set(doc, '_actions', {});
		// 	}
		// 	doc._actions[methodName] = actionType;
		// 	model._stats[methodName]/*[actionType]*/.calls++;
		// 	model._stats[methodName][actionType]++;
		// 	console.verbose(`[doc ${model.modelName}].pre('${methodName}'): doc=${doc._id} doc._actions=${inspect(doc._actions)} model._stats.${methodName}=${inspect(model._stats[methodName])}`);// args=${inspect(args)} ${args.length}`);
		// 	next();
		// });

		// schema.post(methodName, function(/*err,*/ res, next) {
		// 	// console.verbose(`post ${methodName}: doc=${inspect(doc)} next=${next}`);
		// 	var doc = this;
		// 	var model = this.constructor;
		// 	var actionType = doc._actions[methodName];
		// 	doc._actions[methodName] = null;
		// 				// if (err) {
		// 	// 	console.warn(`${debugPrefix}.post('${methodName}'): error: ${err.stack||err}`);
		// 	// 	return model._stats[methodName][actionType].errors.push(err);				
		// 	// }
		// 	console.verbose(`[doc ${model.modelName}].post('${methodName}'): doc=${doc._id} res=${inspect(res)} doc._actions=${inspect(doc._actions)} model._stats.${methodName}=${inspect(model._stats[methodName])}`);// args=${inspect(args)} ${args.length}`);
		// 	var eventName = 'post.' + methodName;
		// 	model.emit(eventName, doc);
		// 	doc.emit(eventName);			// i wonder what this gets bound as? in any case shuld be the doc
		// 	model._stats[methodName]/*[actionType]*/.success++;
		// 	next();
		// });

	// });


	schema.static('construct', function construct(data, cb) {
		return Q(new (this)(data));
	});

	/* Updates an (in memory, not DB) document with values in the update parameter,
	 * but only marks paths as modified if the (deep-equal) value actually changed
	 * I think mongoose is supposed to be able to doc.set() and only mark paths and subpaths that have actually changed, 
	 * but it hasn't wqorked for me in the past, so i wrote my own. */
	schema.method('updateDocument', function(update, pathPrefix = '') {
		var model = this.constructor;
		if (pathPrefix !== '' && !pathPrefix.endsWith('.')) {
			pathPrefix += '.';
		}
		_.forEach(update, (updVal, propName) => {
			var fullPath = pathPrefix + propName;
			var docVal = this.get(fullPath);
			var schemaType = this.schema.path(fullPath);
			if (schemaType && ([ 'Embedded', 'Mixed', 'Map', 'Array', 'DocumentArray', 'ObjectID' ].includes(schemaType.instance))) {
				console.debug(`[model ${model.modelName}].updateDocument: ${fullPath}: ${schemaType.instance}`);
				this.updateDocument(/*schemaType.options.ref && schemaType.instance === 'ObjectID' && updVal && updVal._id ? updVal._id :*/ updVal, fullPath + '.');
			} else if (!_.isEqual(docVal, updVal)) {
				console.debug(`[model ${model.modelName}].updateDocument: ${fullPath}: Updating ${docVal} to ${updVal} (schemaType: ${schemaType && schemaType.instance}`);
				this.set(fullPath, updVal);
			} else {
				console.debug(`[model ${model.modelName}].updateDocument:${fullPath}: No update to ${docVal}`);
			}
		});
		return Q(this);
	});

	/* Find a document in the DB given the query, if it exists, and update the (in memory) document with supplied data.
	 * Or just create a new doc (in memory, not DB - uses constructor func and not model.create())
	 * If the schema has a discriminatorKey, checks incoming data object for that key and uses the corresponding discriminator model's functions
	 * That way this plugin overall should work on schemas with discriminators or without, or both (I think) - e.g. FsEntry and File
	 * If I was using model.create() instead of the constructor I think it is *supposed* to handle that automagically (but who knows)
	 * But that's not the behaviour I want - I don't want it saving or validating anything until it's explicitly told to (in bulk, usuallyt)
	 * Then again - maybe validation would be handy e.g. for a file object, before it gets passed to e.g. the audio plugin (... oh god this shit's getting complicated again)
	 * 181015 - So now added functionality where data can be a function instead of an obejct, where the function returns an object (the data)
	 * when it's called - but it will only get called if the data 2wasn't found first. Saves expensive operations if unnecessary. (like mm.parseFile())) 
	 * !! Hold on - the use case here for Audio is different to File. Even if a File is found this method still does updateDocument(data),
	 * whereas with Audio I think I just want to skip it completley - unless the file has changed more recently than the Audio document was updated/checked 
	 * WOW this is getting complex again :) I think I can't use this function for the audio thing ... */
	schema.static('findOrCreate', function findOrCreate(query, data, options, cb) {
		const defaultOptions = {
			saveImmediate: false		// if true, calls doc.save() immediately after creation or after finding the doc 
		};
		if (!_.isPlainObject(query)) {
			throw new TypeError(`query must be a plain object, but query=${inspect(query)}`);
		} else if (typeof data === 'function' && !options && !cb) {
			cb = data;
			data = query;
			options = defaultOptions;
		} else if (!data) {
			data = query;
			options = defaultOptions;
		} else if (typeof options === 'function') {
			cb = options;
			options = defaultOptions;
		} else if (!options) {
			options = defaultOptions;
		}
		var dk = schema.options.discriminatorKey;
		var model = dk && data[dk] && this.discriminators[data[dk]] ? this.discriminators[data[dk]] : this;
		console.debug(`[model ${this.modelName}(dk=${dk})].findOrCreate(): query=${inspect(query,{compact:true})} data='${inspect(data)}' data[dk]='${data[dk]}': setting model='${/*inspect*/(model.modelName)}'`);

		return Q(model.findOne(query))
		.then(r => r ? r.updateDocument(data) : model.construct(data))
		// .then(doc => _.set(doc, '_actions', {}))
		.then(doc => options.saveImmediate ? doc.save() : doc);
	});

	// Artefact related

	schema.add({
		// _artefact: { type: mongoose.SchemaTypes.Mixed, required: false, default: undefined },
		_primary: { type: mongoose.SchemaTypes.ObjectId, refPath: '_primaryType', required: false, default: undefined },
		_primaryType: { type: String, required: false/*true*/, default: undefined }
	});
	schema.virtual('_artefact');

	/* Find a _meta document from the given model(table)
	 * */
	schema.method('getArtefact', function getArtefact(options = {}) {
		
		var doc = this;
		var dk = schema.options.discriminatorKey;
		var docModel = this.constructor;
		var docModelName = doc[dk] || docModel.modelName;//docModel.discriminators[doc[dk]] && doc.constructor.discriminators[doc[dk]] ? doc.constructor.discriminators[doc[dk]] : doc.constructor;
		// TODO: 181201: Do you want the model name being the discriminator value? or aybe the baseModleName + '.' or ':' + discrim value (e.g. "file" and "dir" or "fs.file" and "fs.,dir" - may become necessary or desirable if typenames are likely to collide)

		doc._primary = doc;
		doc._primaryType = docModelName;

		function doMetaPipe(meta, promisePipe) {
			if (!promisePipe) {
				return meta;
			}
			if (_.isArray(promisePipe)) {
				promisePipe = chainPromiseFuncs(promisePipe);
			} else if (typeof promisePipe !== 'function') {
				throw new TypeError(`doMetaPipe: promisePipe should be a function or array, but is a ${typeof promisePipe}`);
			}
			return promisePipe(meta);
		}

		var a = Object.create({
			
			// get _primaryDataType() { return docModelName; },
			// get _primaryDataId() { return doc._id; },
			// get _primaryData() { return doc; },

			// get [docModelName]() { return doc; },
			
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
				console.debug(`Artefact.addMetaData('${modelName}'): this=${inspect(this, { compact: false })}`);
				if (this[modelName]) {
					console.debug(`Artefact.addMetaData('${modelName}'): meta exists: ${inspect(this[modelName], { compact: false })}`);
					return Q(this);
				} else {
					if (typeof modelName !== 'string') throw new TypeError('modelName must be a string');
					var model = mongoose.model(modelName);
					if (!model) throw new Error(`model '${modelName}' does not exist`);
					var data = doMetaPipe(new model(_.assign({ /*_artefact: a,*/ _primary: doc, _primaryType: docModelName }, data)), promisePipe);
					console.debug(`Artefact.addMetaData('${modelName}'): this=${inspect(this, { compact: false })}, data=${inspect(data, { compact: false })}`);
					return Q(Object.defineProperty(this, modelName, { writeable: true, enumerable: true, value: data }));
				}
			},

			addOrFindMetaData(modelName, data, promisePipe) {
				var model = mongoose.model(modelName);
				return model.findOrCreate(_.assign({ /*_artefact: a,*/ _primary: doc, _primaryType: docModelName }, data))
				.then(meta => {
					console.debug(`getArtefact: docModelName=${docModelName} modelName='${modelName}': model=${model.count()} meta=${inspect(meta, { compact: false })}, promisePipe: ${promisePipe?'yes':'no'}`);
					if (meta) {
						meta = doMetaPipe(meta, promisePipe);
						// meta._artefact = this;
						Object.defineProperty(this, modelName, { writeable: true, enumerable: true, value: meta });
					}
				}).then(() => this);
			},

			findMetaData(modelName, promisePipe) {
				var model = mongoose.model(modelName);
				return model.findOne({ _primary: doc, _primaryType: docModelName })
				.then(meta => {
					console.debug(`getArtefact: docModelName=${docModelName} modelName='${modelName}': model=${model.count()} meta=${!meta?'(null)':inspect(meta, { compact: false })}`);
					if (meta) {
						meta = doMetaPipe(meta, promisePipe);
						// meta._artefact = this;
						Object.defineProperty(this, modelName, { writeable: true, enumerable: true, value: meta });
					}
				}).then(() => this);
			}

		}, {
			// _primaryDataType: { enumerable: true, value: docModelName },
			// _primaryDataId: doc._id,
			[docModelName]: { writeable: true, enumerable: true, value: doc }
		});
		doc._artefact = a;

		var allModels = options.meta ? _.keys(options.meta) :
			_.filter(mongoose.modelNames(), modelName => {
				var m = mongoose.model(modelName);
				return m.discriminators === undefined && docModel.baseModelName != m.baseModelName && docModel.modelName != m.baseModelName && docModel.baseModelName != m.modelName;
			});
		
		return Q.all(_.map(allModels, modelName => a[modelName] ? Q(a[modelName]) : a.findMetaData(modelName, options.meta ? options.meta[modelName] : undefined)))
		.then(() => { console.debug(`getArtefact: docModelName=${docModelName} allModels=[ ${allModels.map(mn=>`'${mn}'`).join(', ')} ] a=${inspect(a, { compact: false })}`); })
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
			console.debug(`[model ${model.modelName}].getArtefacts().promisePipe(): options=${inspect(options, { compact: true })} cursor=${inspect(cursor, { compact: false })}`);
			return promisePipe(cursor, options, ...fns);
		}});
		console.debug(`[model ${model.modelName}].getArtefacts(): options=${inspect(options, { compact: true })} cursor=${inspect(cursor, { compact: false })}`);
		return cursor;
	};

	schema.method('isCheckedSince', function isCheckedSince(timestamp) {
		if (!_.isDate(timestamp)) {
			throw new TypeError(`isCheckedSince: timestamp must be a Date`);
		}
		return !this.isNew && this._ts.checkedAt > timestamp;
	});

};
