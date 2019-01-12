"use strict";
const console = require('../../stdio.js').Get('model/plugin/bulk-save', { minLevel: 'verbose' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
mongoose.Promise = Q.Promise;

module.exports = function bulkSaveSchemaPlugin(schema, options) {
	schema.plugin(require('./stat.js'), { data: { bulkSave: {} } });

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

		// console.verbose(`[model ${model.modelName}].bulkSave(): isNew=${doc.isNew} isModified()=${doc.isModified()} modifiedPaths=${doc.modifiedPaths()}`);

		//Q.Promise((resolve, reject, notify) => {
		return doc.validate().then(() => {
				
				// insert, update, or do nothing depending if the doc is new, updated or unmodified
				// var actionType = doc._actions['bulkSave'];//doc.isNew ? 'created' : /*doc._id !== null && */doc.isModified() ? 'updated' : 'checked';
				// model._stats.bulkSave[actionType]++;
				// model._stats.bulkSave.calls++;
				console.verbose(`[model ${model.modelName}].bulkSave isNew=${doc.isNew} isModified()=${doc.isModified()} modifiedPaths=${doc.modifiedPaths()} model._bulkSaveDeferred.promise.state=${model._bulkSaveDeferred?model._bulkSaveDeferred.promise.state:'(undefined)'}`);	// action=${actionType}
				// if (actionType === 'check') {
				// 	model._stats.bulkSave.success++;
				// 	return Q(doc);//(doc);
				// }
				if (!model._bulkSave) {
					model._bulkSave = [];
					_.set(model, '_bulkSaveDeferred', Q.defer());
				} else if (model._bulkSave.indexOf(doc) >= 0) {
					console.verbose(`[model ${model.modelName}].bulkSave doc._id=${doc._id}: doc already queued for bulkWrite`);// (array index #${di}`); //  action=${actionType}
					return Q(doc);
				}

				model._bulkSave.push(/*_.set*/(doc/*.toObject(), '_actions', doc._actions*/));
				if (model._bulkSave.length >= options.maxBatchSize) {
					if (model._bulkSaveTimeout) {
						clearTimeout(model._bulkSaveTimeout);
						delete model._bulkSaveTimeout;
					}
					((bs, bsd) => {
						// model._bulkSaveDeferredCurrent = (model._bulkSaveDeferredCurrent ? model._bulkSaveDeferredCurrent : Q()).then(bsd);
						/*process.nextTick(() => */innerBulkSave(bs, bsd);
					})/*)*/(model._bulkSave, model._bulkSaveDeferred);
					var ret = model._bulkSaveDeferred/*.promise*/;
					model._bulkSave = [];
					_.set(model, '_bulkSaveDeferred', Q.defer());
					// _.set(model, '_bulkSaveDeferredAccum', (model._bulkSaveDeferredAccum ? model._bulkSaveDeferredAccum : Q()).then(ret));
					return ret;
				} else if (!model._bulkSaveTimeout) {
					((bs, bsd) =>  {
						// model._bulkSaveDeferredCurrent = (model._bulkSaveDeferredCurrent ? model._bulkSaveDeferredCurrent : Q()).then(bsd);
						model._bulkSaveTimeout = setTimeout(() => innerBulkSave(bs, bsd), options.batchTimeout);
					})(model._bulkSave, model._bulkSaveDeferred);
					var ret = model._bulkSaveDeferred/*.promise*/;
					model._bulkSave = [];
					_.set(model, '_bulkSaveDeferred', Q.defer());
					// _.set(model, '_bulkSaveDeferredAccum', (model._bulkSaveDeferredAccum ? model._bulkSaveDeferredAccum : Q()).then(ret));
					return ret;
				} else {
					return model._bulkSaveDeferred/*.promise*/;
				}
			
				// resolves the return promise with the document queued for bulk writing, although it is not written yet
				// resolve(doc);
				// return Q(doc);//model._bulkSaveDeferred.promise;
				
				// Perform actual bulk save
				function innerBulkSave(bs, bsd) {
					var bulkOps = _.map(bs, bsDoc => ({ updateOne: { filter: { _id: bsDoc._doc._id }, update: { $set: bsDoc._doc }, upsert: true } }));
					console.debug(`[model ${model.modelName}].innerBulkSave( [${bulkOps.length}] = ${inspect(bulkOps, { depth: 3, compact: true })}\nbs=${inspect(bulkOps, { depth: 5, compact: true })} )`);
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
						console.verbose(`[model ${model.modelName}].innerBulkSave(): bulkWriteOpResult=${inspect(bulkWriteOpResult)} bs[0].isNew=${bs[0].isNew} isModified()=${doc.isModified()} modifiedPaths=${doc.modifiedPaths()} model._bulkSaveDeferred.promise.state=${model._bulkSaveDeferred?model._bulkSaveDeferred.promise.state:'(undefined)'}`);
						if (bulkWriteOpResult.result.ok) {
							bsd.resolve(bulkWriteOpResult);
						} else {
							bsd.reject(bulkWriteOpResult);
						}
					})
					.catch(err => bsd.reject(err))
					.done();
				}
			});//.catch(err => reject(err));
		// });

	});

	// schema.pre('bulkSave', function() {
	// 	var model = this.constructor;
	// 	var doc = this;

	// 	options = _.assign({
	// 		maxBatchSize: 10,
	// 		batchTimeout: 750
	// 	}, options);

	// 	console.verbose(`[model ${model.modelName}].pre('bulkSave'): options=${inspect(options)} isNew=${doc.isNew} isModified()=${doc.isModified()} modifiedPaths=${doc.modifiedPaths()}`);

	// 	model._stats.bulkSave.calls++;
	// 	var actionType = doc.isNew ? 'create' : doc.isModified() ? 'update' : 'check';
	// 	doc._actions = _.merge(doc._actions || {}, { bulkSave: actionType });
	// 	model._stats.bulkSave[actionType]++;
	// })

	// schema.post('bulkSave')
};
