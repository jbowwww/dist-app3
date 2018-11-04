"use strict";
const console = require('../../stdio.js').Get('model/plugin/standard', { minLevel: 'log' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
mongoose.Promise = Q.Promise;
const { artefactDataPipe, chainPromiseFuncs } = require('../../promise-pipe.js');

/* Standard/common schema methods, statics
 */
module.exports = function standardSchemaPlugin(schema, options) {

	console.verbose(`standardSchemaPlugin(): schema=${inspect(schema)}, options=${inspect(options)}, this=${inspect(this)}`);

	schema.plugin(require('./stat.js'), { data: { save: {}, validate: {} } });
	
	schema.pre('validate', function(next) {
		var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
		console.debug(`stat: pre('validate'): actionType=${actionType} id=${this._id.toString()}`);//: modelName=${this.constructor.modelName} keys(this.constructor)=${_.keys(this.constructor).join(', ')} keys(this.constructor.prototype)=${_.keys(this.constructor.prototype).join(', ')}`);
		this.constructor._stats.validate[actionType]++;
		this.constructor._stats.validate.calls++;
		return next();
	});
	schema.post('validate', function(doc, next) {
		console.debug(`stat: post('validate'): id=${this._id.toString()}`);//: modelName=${this.constructor.modelName} keys(this.constructor)=${_.keys(this.constructor).join(', ')} keys(this.constructor.prototype)=${_.keys(this.constructor.prototype).join(', ')}`);
		// this.constructor._stats.validate.success++;
			return next();
	});
	schema.post('validate', function(err, doc, next) {
		// console.error(`stat: post('validate') error: id=${this._id.toString()}: ${err.stack||err.message||err}`);
		this.constructor._stats.validate.errors.push(err);
		return next(err);
	});

	schema.pre('save', function(next) {
		var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
		console.debug(`stat: pre('save'): actionType=${actionType} id=${this._id.toString()}`);
		this.constructor._stats.save[actionType]++;
		this.constructor._stats.save.calls++;
		return next();
	});
	schema.post('save', function(doc, next) {
		console.debug(`stat: post('save'): id=${this._id.toString()}`);
		// this.constructor._stats.save.success++;
		return next();
	});
	schema.post('save', function(err, doc, next) {
		console.error(`stat: post('save') error: id=${this._id.toString()}: ${err.stack||err.message||err}`);
		this.constructor._stats.save.errors.push(err);
		return next(err);
	});

	/* Updates an (in memory, not DB) document with values in the update parameter,
	 * but only marks paths as modified if the (deep-equal) value actually changed
	 * I think mongoose is supposed to be able to doc.set() and only mark paths and subpaths that have actually changed, 
	 * but it hasn't wqorked for me in the past, so i wrote my own. */
	schema.method('updateDocument', function(update, pathPrefix = '') {
		if (pathPrefix !== '' && !pathPrefix.endsWith('.')) {
			pathPrefix += '.';
		}
		_.forEach(update, (updVal, propName) => {
			var fullPath = pathPrefix + propName;
			var docVal = this.get(fullPath);
			var schemaType = this.schema.path(fullPath);
			if (schemaType && ([ 'Embedded', 'Mixed', 'Map', 'Array', 'DocumentArray' ].includes(schemaType.instance))) {
				console.debug(`updateDocument: ${fullPath}: ${schemaType.instance}`);
				this.updateDocument(updVal, fullPath + '.');
			} else if (!_.isEqual(docVal, updVal)) {
				console.debug(`updateDocument: ${fullPath}: Updating ${docVal} to ${updVal} (schemaType: ${schemaType && schemaType.instance}`);
				this.set(fullPath, updVal);
			} else {
				console.debug(`updateDocument:${fullPath}: No update to ${docVal}`);
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
	schema.static('findOrCreate', function findOrCreate(query, data, cb) {
		if (!_.isPlainObject(query)) {
			throw new TypeError(`query must be a plain object, but query=${inspect(query)}`);
		} else if (typeof data === 'function' && !cb) {
			cb = data;
			data = query;
		} else if (!data) {
			data = query;
		}
		var dk = schema.options.discriminatorKey;
		var model = dk && data[dk] && this.discriminators[data[dk]] ? this.discriminators[data[dk]] : this;
		console.debug(`[model ${this.modelName}(dk=${dk})].findOrCreate(): query=${inspect(query,{compact:true})} data='${inspect(data)}' data[dk]='${data[dk]}': setting model='${/*inspect*/(model.modelName)}'`);
		return Q(model.findOne(query).then(r => r ? r.updateDocument(data) : new (model)(data)));	//new (this)(data)));//this.create(data)));
	});

	/*
	 * Artefact related
	 */

	schema.add({
		// _artefact: { type: mongoose.SchemaTypes.Mixed, required: false, default: undefined },
		_primary: { type: mongoose.SchemaTypes.ObjectId, refPath: '_primaryType', required: false, default: undefined },
		_primaryType: { type: String, required: false/*true*/, default: undefined }
	});
	schema.virtual('_artefact');

	/* Find a _meta document from the given model(table)
	 * */
	schema.static('getArtefacts', function getArtefacts(query, options = {}) {
		var model = this;
		console.log(`toArtefact(): model=${inspect(model, { compact: false })}, options=${inspect(options, { compact: false })}`);
		return model.find(query).cursor({ transform: doc => doc.getArtefact(options) });
	});

	/* Find a _meta document from the given model(table)
	 * */
	schema.method('getArtefact', function getArtefact(options = {}) {
		
		var doc = this;
		var docModel = this.constructor;
		var docModelName = docModel.modelName;

		doc._primary = doc;
		doc._primaryType = docModelName;

		var a = Object.create({
			
			// get _primaryDataType() { return docModelName; },
			// get _primaryDataId() { return doc._id; },
			// get _primaryData() { return doc; },

			// get [docModelName]() { return doc; },
			
			bulkSave(opts) {
				opts = _.assign({
					maxBatchSize: 10,
					batchTimeout: 750
				}, opts);
				console.verbose(`Artefact.bulkSave(opts=${inspect(opts, { compact: true })}: ${inspect(this, { compact: false })}`);
				return Q.all(
					_.map(this, (data, dataName) => data.bulkSave(opts.meta && opts.meta[dataName] ? opts.meta[dataName] : opts))
				)
				.then(() => this);
			},

			addMetaData(modelName) {
					console.debug(`Artefact.addMetaData('${modelName}'): this=${inspect(this, { compact: false })}`);
				// if (Object.hasOwnProperty(this, modelName)) {
					if (this[modelName]) {
					console.debug(`Artefact.addMetaData('${modelName}'): meta exists: ${inspect(this[modelName], { compact: false })}`);
					return Q(this);
				} else {
					if (typeof modelName !== 'string') throw new TypeError('modelName must be a string');
					var model = mongoose.model(modelName);
					if (!model) throw new Error(`model '${modelName}' does not exist`);
					var data = new model({ _artefact: a, _primary: doc, _primaryType: docModelName });	//_metaParent: doc._id });/*model.create();*/
					// data.updateDocument({ _metaParent: doc._id });
					// data._metaParent = doc._id;
					// return data.validate().then(() => 
					console.debug(`Artefact.addMetaData('${modelName}'): this=${inspect(this, { compact: false })}, data=${inspect(data, { compact: false })}`);
					return Object.defineProperty(this, modelName, { writeable: true, enumerable: true, value: data });
					// );
				}
			}

		}, {
			// _primaryDataType: { enumerable: true, value: docModelName },
			// _primaryDataId: doc._id,
			[docModelName]: { writeable: true, enumerable: true, value: doc }
		});

		doc._artefact = a;

		var allModels = options.meta ? _.keys(options.meta) : mongoose.modelNames();
		return Q.all(_.map(allModels, modelName => {
			var model = mongoose.model(modelName);
			return model.findOrCreate({ _primary: doc, _primaryType: docModelName })
			// .exec()
			.then(meta => {
				console.debug(`getArtefact: docModelName=${docModelName} modelName='${modelName}': model=${model.count()} meta=${inspect(meta, { compact: false })}`);
				if (meta) {
					Object.defineProperty(a, modelName, { writeable: true, enumerable: true, value: meta });
					meta._artefact = a;
				}
				return (options.meta && options.meta[modelName] ?
					typeof options.meta[modelName] === 'function' ? options.meta[modelName](meta)
		 		:  _.isArray(options.meta[modelName]) ? chainPromiseFuncs(options.meta[modelName])(meta)
			 : 	Q(meta) : Q(meta));
			})
		}))
		.then(() => {

			console.verbose(`getArtefact: docModelName=${docModelName} allModels=[ ${allModels.map(mn=>`'${mn}'`).join(', ')} ] a=${inspect(a, { compact: false })}`);
			return Q(a);

		});
	
	});

	schema.method('isCheckedSince', function isCheckedSince(timestamp) {
		if (!_.isDate(timestamp)) {
			throw new TypeError(`isCheckedSince: timestamp must be a Date`);
		}
		return !this.isNew && this._ts.checkedAt > timestamp;
	});
};
