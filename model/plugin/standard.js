"use strict";
const console = require('../../stdio.js').Get('model/plugin/standard', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, tap, iff, streamPromise }  = require('../../promise-pipe.js');
const mongoose = require('mongoose');
const Artefact = require('../../Artefact.js');
const statPlugin = require('./stat.js');

// TODO: Work out separation of concerns with model._stats and all your separate plugins e.g. bulksave (stat plugin is more of a plugin plugin)

/* Standard/common schema methods, statics
 */
module.exports = function standardSchemaPlugin(schema, options) {

	console.debug(`standardSchemaPlugin(): schema=${inspect(schema)}, schema.prototype=${inspect(schema.prototype)}, options=${inspect(options)}, this=${inspect(this)}`);
	
	var discriminatorKey = schema.get('discriminatorKey');
	var model;
	var modelInitDefer = Q.defer();
	var modelInitPromise = modelInitDefer.promise;
	var debugPrefix;

	schema.on('init', function(_model) {
		model = _model;
		debugPrefix = `[model ${model.modelName}]`;
		console.verbose(`${debugPrefix}.on('init'): _stats=${inspect(model._stats)}`);
		// var dModel = discriminatorKey && data[discriminatorKey] && model.discriminators[data[discriminatorKey]] ? model.discriminators[data[discriminatorKey]] : model;
		modelInitDefer.resolve(model);
	});
		
	schema.plugin(statPlugin, { data: {
		instance: [ 'validate', 'save', 'bulkSave' ],
		static: [ 'upsert' ]
	} });

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
	 * WOW this is getting complex again :) I think I can't use this function for the audio thing ... 
	 * args: // [query, ] data[, options][, cb] */
	schema.static('findOrCreate', function findOrCreate(...args) {
		discriminatorKey = schema.get('discriminatorKey');
		model = this;
		debugPrefix = `[model ${model.modelName}]`;
		console.verbose(`${debugPrefix}.on('init'): _stats=${inspect(model._stats)}`);

		var cb, data, options = {
			saveImmediate: false,			// if true, calls doc.save() immediately after creation or after finding the doc 
			query: undefined				// if not specified, tries to find a findOrCreate default query defined by the schema, or then if data has an _id, use that, or lastly by default query = data 
		};
		_.forEach(args, (arg, i) => {
			if (cb) {
				throw new TypeError(`findOrCreate accepts args data[, options][, cb]. Callback is not last, cb !== null at arg #${i}. (args=${inspect(args)})`);
			}
			if (typeof arg === 'function') {
				cb = arg;
			} else if (typeof arg === 'object') {
				if (!data) {
					data = arg;
				} else {
					_.assign(options, arg);
				}
			} else {
				throw new TypeError(`findOrCreate accepts args data[, options][, cb]. Unexpected parameter type ${typeof arg} for arg #${i}. (args=${inspect(args)})`);
			}
		});
		
		// I don't think the parsing/defaulting logic here is correct
		if (!options.query) {
			options.query = schema.get('defaultFindQuery') || (data._id ? { '_id': data._id } : _.clone(data));
		}
		if (_.isArray(options.query) && _.each(options.query, v => typeof v === 'string')) {
			options.query = _.pick(data, options.query);	
		} else if (_.isObject(options.query)) {
			options.query = _.mapValues(schema.get('defaultFindQuery'), (v, k) => v === undefined ? data[k] : v);
		}

		// model = discriminatorKey && data[discriminatorKey] && model.discriminators[data[discriminatorKey]] ? this.discriminators[data[discriminatorKey]] : this || model;
		console.verbose(`[model ${model.modelName}(dk=${discriminatorKey})].findOrCreate(): options=${inspect(options, { depth:3, compact: true })} defaultFindQuery=${inspect(schema.get('defaultFindQuery'), { compact: true })}`);	// q=${inspect(q)}' data='${inspect(data)}' data[dk]='${data[discriminatorKey]}': setting model='${/*inspect*/(model.modelName)}

		return Q(model.findOne(options.query))
		// return q./*exec().*/
		.then(r => { console.verbose(`${debugPrefix}.findOrCreate(): r = ${r}`); return r; })
		.then(r => (r ? r.updateDocument(data) : /*model.create*/ model.construct /*new (model)*/ (data)));
		// .then(r => console.verbose(`${debugPrefix}.findOrCreate()2: r = ${r}`))
		// .then(doc => options.saveImmediate ? doc.save() : doc)
											// var q = model.findOneAndUpdate(query, data, { upsert: true });
			
	});

	// What is the difference between these methods and findOrCreate?? I think there was something but it may
	// be so subtle and minor that it is not worth having both
	schema.static('upsert', function upsert(...args) {

		var [ doc, options, cb ] = args;	// doc may be a mongoose doc or  POJO
		// var discriminatorKey = schema.get('discriminatorKey');
		var discriminator = discriminatorKey ? doc[discriminatorKey] : undefined;
		var model = discriminatorKey && discriminator && this.discriminators[discriminator] ? this.discriminators[discriminator] : this;

		var debugPrefix = `[model ${model.modelName}].upsert:`;//${discriminatorKey?`(discriminatorKey=${discriminatorKey})`:''}]`;

		if (!(doc instanceof mongoose.Document) && !_.isObject(doc)) {
				throw new TypeError(`Incorrect argument types for ${debugPrefix} expected:(object doc[, object options][, function cb]) received:${inspect(args)}`);
		}
		if (typeof options === 'function') {
			if (!cb) {
				cb = options; options = {};
			} else {
				throw new TypeError(`Incorrect argument types for ${debugPrefix} expected:(object doc[, object options][, function cb]) received:${inspect(args)}`);
			}
		} else if (options && typeof options !== 'object') {
			throw new TypeError(`Incorrect argument types for ${debugPrefix} expected:(object doc[, object options][, function cb]) received:${inspect(args)}`);
		}
		if (!options) {
			options = {};
		}
		
		var q = options.query || schema.get('defaultFindQuery');	// can i actually maybe use model.$where for this? see mongoose-notes.txt
		if (_.isArray(q) && _.each(q, v => typeof v === 'string')) {
			q = _.pick(doc, q);	
		} else if (_.isObject(q)) {
			q = _.mapValues(q, (v, k) => v === undefined ? doc[k] : v);
		}
		options = _.assign(_.omit(options, 'query'), { upsert: true });

		console.verbose(`${debugPrefix} options=${inspect(options, { depth: 3, compact: true })} defaultFindQuery=${inspect(schema.get('defaultFindQuery'), { compact: true })} doc=${inspect(doc, { depth: 1, compact: false })}`);

		return Q(model.updateOne.call(model, q, doc, options, cb))/*.then(() => null)*/;		// or could also use bulkSave?  and use Query.prototype.getUpdate() / getQuery()
	});

	schema.method('upsert', function upsert(...args) {

		var [ options, cb ] = args;	// doc may be a mongoose doc or  POJO
		var doc = this;
		var model = doc.constructor;

		var debugPrefix = `[doc ${model.modelName}].upsert:`;//${discriminatorKey?`(discriminatorKey=${discriminatorKey})`:''}]`;

		if (!(doc instanceof mongoose.Document) && !_.isObject(doc)) {
			throw new TypeError(`Incorrect argument types for ${debugPrefix} expected:([object options][, function cb]) received:${inspect(args)}`);
		}
		if (typeof options === 'function') {
			if (!cb) {
				cb = options; options = {};
			} else {
				throw new TypeError(`Incorrect argument types for ${debugPrefix} expected:([object options][, function cb]) received:${inspect(args)}`);
			}
		} else if (options && typeof options !== 'object') {
			throw new TypeError(`Incorrect argument types for ${debugPrefix} expected:([object options][, function cb]) received:${inspect(args)}`);
		}
		if (!options) {
			options = {};
		}
		
		var q = options.query || schema.get('defaultFindQuery');	// can i actually maybe use model.$where for this? see mongoose-notes.txt
		if (_.isArray(q) && _.each(q, v => typeof v === 'string')) {
			q = _.pick(doc, q);	
		} else if (_.isObject(q)) {
			q = _.mapValues(q, (v, k) => v === undefined ? doc[k] : v);
		}
		options = _.assign(_.omit(options, 'query'), { upsert: true });

		console.verbose(`${debugPrefix} options=${inspect(options, { depth: 3, compact: true })} defaultFindQuery=${inspect(schema.get('defaultFindQuery'), { compact: true })} doc=${inspect(doc, { depth: 1, compact: false })}`);

		return Q(model.updateOne.call(model, q, doc, options, cb))/*.then(() => null)*/;		// or could also use bulkSave?  and use Query.prototype.getUpdate() / getQuery()
	});

	schema.query.useCache = function useCache() {
		// var debugPrefix = `[query ${_model.modelName}]`;//mongoose.model('')
		var q = this.getQuery();
		var jq = JSON.stringify(q);
		var r = model._cache.get(jq);
		if (!r) {
			console.verbose(`${debugPrefix}.useCache: new q '${inspect(q, { compact: true })}'`);
			return this.exec().then(r => {
				model._cache.set(jq, r);
				return r;
			});
		} else {
			console.verbose(`${debugPrefix}.useCache: found '${inspect(q, { compact: true })}'`);
			return Q(r);
		}
	};
	schema.on('init', model => { Object.defineProperty(model, '_cache', { value: new Map() }); });

	schema.query.promisePipe = function promisePipe(...promiseFuncs) {
		return streamPromise(writeablePromiseStream(...promiseFuncs), { resolveEvent: 'finish' });
	};

	/* 181222: Note: Don't use bulkSave (at least currently) in a promisePipe unless it is at the END or at the END of a tap chain
	 * Because currently it returns a bulkwriteopresult and not the document (unless the doc is unmodified requiring no save, then it returns a doc
	 * 190112: I should probably change this behaviour to return the doc, so it can be anywhere in a chain?
	 * 
	 */
	schema.method('bulkSave', function bulkSave(options) {

		var model = this.constructor;
		var doc = this;

		options = _.assign({
			maxBatchSize: 10,
			batchTimeout: 750
		}, options);

		return doc.validate().then(() => {
				
				// insert, update, or do nothing depending if the doc is new, updated or unmodified
				// var actionType = doc._actions['bulkSave'];//doc.isNew ? 'created' : /*doc._id !== null && */doc.isModified() ? 'updated' : 'checked';
				// model._stats.bulkSave[actionType]++;
				// model._stats.bulkSave.calls++;
				console.verbose(`[model ${model.modelName}].bulkSave isNew=${doc.isNew} isModified()=${doc.isModified()} modifiedPaths=${doc.modifiedPaths()}`);// model._bulkSaveDeferred.promise.state=${model._bulkSaveDeferred?model._bulkSaveDeferred.promise.state:'(undefined)'}`);	// action=${actionType}
				// if (actionType === 'check') {
				// 	model._stats.bulkSave.success++;
				// 	return Q(doc);//(doc);
				// }
				if (!model._bulkSave) {
					model._bulkSave = [];
					// _.set(model, '_bulkSaveDeferred', Q.defer());
				} else if (model._bulkSave.indexOf(doc) >= 0) {
					console.verbose(`[model ${model.modelName}].bulkSave doc._id=${doc._id}: doc already queued for bulkWrite`);// (array index #${di}`); //  action=${actionType}
					return Q(doc);
				}

				var deferred = Q.defer();
				model._bulkSave.push({ doc, deferred, opIndex: model._bulkSave.length });
				if (model._bulkSave.length >= options.maxBatchSize) {
					// if (model._bulkSaveTimeout) {
					// 	clearTimeout(model._bulkSaveTimeout);
					// 	delete model._bulkSaveTimeout;
					// }
					/*process.nextTick(() => */innerBulkSave();
				} else if (!model._bulkSaveTimeout) {
					model._bulkSaveTimeout = setTimeout(() => innerBulkSave(), options.batchTimeout);
				} 

				// else {
				// 	return model._bulkSaveDeferred/*.promise*/;
				// }
			return deferred.promise;//.timeout(20000, `Error bulk writing doc: ${inspect(doc)}`);
				// resolves the return promise with the document queued for bulk writing, although it is not written yet
				// resolve(doc);
				// return Q(doc);//model._bulkSaveDeferred.promise;
				
				// Perform actual bulk save
				function innerBulkSave() {

					var bs = model._bulkSave;
					model._bulkSave = [];
					if (model._bulkSaveTimeout) {
						clearTimeout(model._bulkSaveTimeout);
						delete model._bulkSaveTimeout;
					}

					var bulkOps = _.map(bs, bsDoc => ({ updateOne: { filter: { _id: bsDoc.doc._doc._id }, update: { $set: bsDoc.doc._doc }, upsert: true } }));
					console.debug(`[model ${model.modelName}].innerBulkSave( [${bulkOps.length}] = ${inspect(bulkOps, { depth: 5, compact: true })} )`);

					// 190112: TODO: Need to separate results for each individual doc and handle accordingly.
					// This will require returning a separate _bulkSaveDeferred for each doc bulkSave is called on, instead of one per batch write. 
					// Also need to imitate mongoose's marking of doc's isNew, isModified &^ modifiedPath & anything else associated, as closely as possible
					// currently, doc's saved with only bulkSave (ie not previously with save()) remain marked with isNew=true and paths marked modified 
					// see Model.prototype.$__handleSave around line 148 of mongoose/lib/model.js, includes, amongst other possibly relevant things, :
				    // this.$__reset();
				    // this.isNew = false;
				    // this.emit('isNew', false);
				    // this.constructor.emit('isNew', false);
				    // Apparently Model.prototype.bulkWrite does not handle any of this document logic (didn't believe it did, just making note for self)
					model.bulkWrite(bulkOps).then(bulkWriteOpResult => {	//bsEntry.op)).then(bulkWriteOpResult => {
						console.verbose(`[model ${model.modelName}].innerBulkSave(): bulkWriteOpResult=${inspect(bulkWriteOpResult, { depth: 6, compact: false })} bs[0].isNew=${bs[0].doc.isNew} bs[0].isModified()=${bs[0].doc.isModified()} bs[0].modifiedPaths=${bs[0].doc.modifiedPaths()}`);// model._bulkSaveDeferred.promise.state=${model._bulkSaveDeferred?model._bulkSaveDeferred.promise.state:'(undefined)'}
						var r = bulkWriteOpResult.result;
						// var upsertedIds = bulkWriteOpResult.getUpsertedIds();// _.map(r.upserted(u => u._id);
						// var insertedIds = bulkWriteOpResult.getInsertedIds();// _.map(r.inserted(i => i._id);
						var writeErrors = bulkWriteOpResult.getWriteErrors();
						// var successOps = _.map(_.concat(upsertedIds, insertedIds), id => _.find(bs, bs => bs.doc._doc._id === id));
						// var errorOps = _.difference(bs, successOps);
						var successOps = bs;
						var errorOps = [];
						console.verbose(`[model ${model.modelName}].innerBulkSave(); successOps=${inspect(successOps)} errorOps=${inspect(errorOps)}`);
						_.forEach(successOps, op => op.deferred.resolve(bulkWriteOpResult));
						_.forEach(errorOps, op => op.deferred.reject(_.assign(new Error(`bulkWrite error for doc._id=${op.doc._doc._id}`), { bulkWriteOpResult })));
						if (writeErrors.length > 0) {
							console.warn(`[model ${model.modelName}].innerBulkSave(); bulkWriteOpResult.getWriteErrors()=${inspect(writeErrors)}`);
						}
						// if (upsertedIds.length != r.nUpserted || insertedIds.length != r.nInserted) {
						// 	var err = new Error(`Upserted or Inserted ID's length does not match result object's count: nUpserted=${r.nUpserted} upsertedIds=${inspect(upsertedIds)} nInserted=${r.nInserted} insertedIds=${inspect(insertedIds)}`);
						// 	// throw err;
						// 	console.warn(`[model ${model.modelName}].innerBulkSave(); bulkWriteOpResult.error: ${err.stack||err}`);
						// }
					})
					.catch(err => {
						console.warn(`[model ${model.modelName}].innerBulkSave(); bulkWrite error for doc._ids=${inspect(_.map(bs, op => op.doc._doc._id))}: ${err.stack||err}`);
					})
					.done();

				}
			});//.catch(err => reject(err));
		// });

	});

};
