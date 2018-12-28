"use strict";
const console = require('../../stdio.js').Get('model/plugin/bulk-save', { minLevel: 'verbose' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
mongoose.Promise = Q.Promise;

// examples from mongoose docs
// conn.on('connected', callback);
// conn.on('disconnected', callback);

module.exports = function bulkSaveSchemaPlugin(schema, options) {
	
	/* 181223TODO: wite a shcema.on('init') for this (and other plugins where appropriate) that performs all init tasks necessary so the plugin is self contained
	 * ie get rid of this madness of this plugin depe3nding on stat variables set by the standard plugin and implemented by the stat plugin
	 */
	/* 181222: Note: Don't use bulkSave (at least currently) in a promisePipe unless it is at the END or at the END of a tap chain
	 * Because currently it returns a bulkwriteopresult and not the document (unless the doc is unmodified requiring no save, then it returns a doc
	 * 181223: Now always resolves to the document, because you actually don't want to wait for the bulkWrite promise if you are working on streams..
	 * What happens if the stream can buffer less items than the bulkWrite? streams starts blocking...
	 * May need to / would be nice to have a way to get the promise for a bulk Write if needed tho */

	 /* 181223: Also adding a mechanism where bulkSave registers the pending bulkWrite with mongo, and if mongo.close() is called, waits for bulk writes first */

	 schema.plugin(require('./stat.js'), 'bulkSave');

	 schema.on('init', model => {
	 	_.forEach({
		 	'_bulkSave': [],
			'_bulkSaveDeferred': Q.defer(),
			'_bulkSaveTimeout': null,
			'_bulkSaveOpPromise': Q(null),
			'_lastPromise': Q(null)
	 	}, (value, key) => {
	 		Object.defineProperty(model, key, { enumerable: true, writeable: true, value: value });
	 	});
	 	console.verbose(`schema bulk save . on init, model='${model.modelName}' stats=${inspect(model._stats)} _bulkSave=${model._bulkSave.length}`);
	});
	
	schema.method('bulkSave', function bulkSave(options) {

		var model = this.constructor;
		var doc = this;

		options = _.assign({
			maxBatchSize: 10,
			batchTimeout: 750
		}, options);

		console.verbose(`[model ${model.modelName}].bulkSave(): isNew=${doc.isNew} isModified()=${doc.isModified()} modifiedPaths=${doc.modifiedPaths()}`);

		return doc.validate()/*.then(model.init())*/.then(() => {
				
				// insert, update, or do nothing depending if the doc is new, updated or unmodified
				var actionType = doc._actions['bulkSave'];
				model._stats.bulkSave[actionType]++;
				model._stats.bulkSave.calls++;
				console.verbose(`[model ${model.modelName}].bulkSave action=${actionType} model._bulkSave=${inspect(model._bulkSave)} model._bulkSaveDeferred=${model._bulkSaveDeferred?inspect(model._bulkSaveDeferred):'(undefined)'}`);
				
				if (model._bulkSave.indexOf(doc) >= 0) {
					console.verbose(`[model ${model.modelName}].bulkSave action=${actionType} doc._id=${doc._id}: doc already queued for bulkWrite`);// (array index #${di}`);
				} else {
					model._bulkSave.push({ updateOne: { filter: { _id: doc._id }, update: { $set: doc.toObject() }, upsert: true } });
					if (model._bulkSave.length >= options.maxBatchSize) {	 // ^ used to choose insertOne or updateOne based on actionType. This is much better. No reason why i can't upsert like this instead
						write(doc, true);
					} else if (!model._bulkSaveTimeout) {
						_.set(model, '_bulkSaveTimeout', setTimeout(() => write(doc, false), options.batchTimeout));
					}
				}

				return Q(doc);

				function write(doc, clearTimer) {
					if (model._bulkSaveTimeout && clearTimer) {
						clearTimeout(model._bulkSaveTimeout);
					}
					var bs = _.slice(model._bulkSave);
					var bsd = model._bulkSaveDeferred;
					// 181224: TODO! : Put it ability for mongo to wait for bulk writes to finish`
					_.assign(model, { _bulkSave: [], _bulkSaveDeferred: Q.defer(), _bulkSaveTimeout: null });
					// process.nextTick(() => 
					innerBulkSave(bs, bsd);
					// );					
				}

				// Perform actual bulk save
				function innerBulkSave(bulkOps, bsd) {
					
					console.log(`[model ${model.modelName}].bulkWrite( [${bulkOps.length}] = ${inspect(bulkOps, { depth: 3, compact: true })}\nbs=${inspect(bulkOps, { depth: 5, compact: true })} )`);
					
					model.bulkWrite(bulkOps).then(bulkWriteOpResult => {	//bsEntry.op)).then(bulkWriteOpResult => {
						if (bulkWriteOpResult.result.ok) {
							model._stats.bulkSave.success += bulkWriteOpResult.result.nModified;
							console.log(`[model ${model.modelName}].innerBulkSave(): bulkWriteOpResult=${inspect(bulkWriteOpResult)}`);
							bsd.resolve(bulkWriteOpResult);
						} else {
							_.each(bulkWriteOpResult.result.writeErrors, writeError => {
								model._stats.bulkSave.errors.push(writeError);
								console.error(`bulkWriteError: ${writeError.stack||writeError}`);
							});
							bsd.reject(bulkWriteOpResult);
						}
					}).catch(err => {	
						model._stats.bulkSave.errors.push(err);
						console.error(`bulkWriteError: ${err.stack||err}`);
						bsd.reject(err);
					}).done();

				}
			}).catch(e => {
				console.error(`[model ${model.modelName}].bulkSave ERROR doc._id=${doc._id} doc._bulkSave=${doc._bulkSave}: error=${e.stack||e}`); 
			});

	});

};
