"use strict";
const console = require('../../stdio.js').Get('model/plugin/bulk-save', { minLevel: 'log' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
mongoose.Promise = Q.Promise;

module.exports = function bulkSaveSchemaPlugin(schema, options) {
		
	/* 181222: Note: Don't use bulkSave (at least currently) in a promisePipe unless it is at the END or at the END of a tap chain
	 * Because currently it returns a bulkwriteopresult and not the document (unless the doc is unmodified requiring no save, then it returns a doc
	 */
	schema.method('bulkSave', function bulkSave(options) {

		var model = this.constructor;
		var doc = this;

		options = _.assign({
			maxBatchSize: 10,
			batchTimeout: 750
		}, options);

		console.verbose(`[model ${model.modelName}].bulkSave(): isNew=${doc.isNew} isModified()=${doc.isModified()} modifiedPaths=${doc.modifiedPaths()}`);

		//Q.Promise((resolve, reject, notify) => {
		return doc.validate().then(() => {
				
				// insert, update, or do nothing depending if the doc is new, updated or unmodified
				var actionType = doc._actions['bulkSave'];//doc.isNew ? 'created' : /*doc._id !== null && */doc.isModified() ? 'updated' : 'checked';
				model._stats.bulkSave[actionType]++;
				model._stats.bulkSave.calls++;
				console.verbose(`[model ${model.modelName}].bulkSave action=${actionType} model._bulkSaveDeferred=${model._bulkSaveDeferred?inspect(model._bulkSaveDeferred):'(undefined)'}`);
				if (actionType === 'check') {
					model._stats.bulkSave.success++;
					return Q(doc);//(doc);
				}// else if (actionType === 'created') {
				
				if (!model._bulkSaveDeferred) {
					_.set(model, '_bulkSaveDeferred', Q.defer());
				}
				if (!model._bulkSave) {
					model._bulkSave = [];
				} else if (model._bulkSave.indexOf(doc) >= 0) {
					console.verbose(`[model ${model.modelName}].bulkSave action=${actionType} doc._id=${doc._id}: doc already queued for bulkWrite`);// (array index #${di}`);
				} else {
					model._bulkSave.push(_.set(doc.toObject(), '_actions', doc._actions));
					if (model._bulkSave.length >= options.maxBatchSize) {
						if (model._bulkSaveTimeout) {
							clearTimeout(model._bulkSaveTimeout);
							delete model._bulkSaveTimeout;
						}
						((bs, bsd) => process.nextTick(() => innerBulkSave(bs, bsd)))(_.slice(model._bulkSave), model._bulkSaveDeferred);
						model._bulkSave = [];
						_.unset(model, '_bulkSaveDeferred');
					} else if (!model._bulkSaveTimeout) {
						
						((bs, bsd) => setTimeout(() => innerBulkSave(bs, bsd), options.batchTimeout))(_.slice(model._bulkSave), model._bulkSaveDeferred);
						
					}
				}

				// resolves the return promise with the document queued for bulk writing, although it is not written yet
				// resolve(doc);
				return Q(doc);//model._bulkSaveDeferred.promise;
				
				// Perform actual bulk save
				function innerBulkSave(bs, bsd) {
					var bulkOps = _.map(bs, bsDoc => bsDoc._actions['bulkSave'] === 'create' ?
						{ insertOne: { document: bsDoc } }
					 : 	{ updateOne: { filter: { _id: bsDoc._id }, update: { $set: bsDoc } } });
					console.verbose(`[model ${model.modelName}].bulkWrite( [${bulkOps.length}] = ${inspect(bulkOps, { depth: 3, compact: true })}\nbs=${inspect(bulkOps, { depth: 5, compact: true })} )`);
					model.bulkWrite(bulkOps).then(bulkWriteOpResult => {	//bsEntry.op)).then(bulkWriteOpResult => {
						if (bulkWriteOpResult.result.ok) {
							model._stats.bulkSave.success += bulkWriteOpResult.result.nModified;
							console.verbose(`[model ${model.modelName}].innerBulkSave(): bulkWriteOpResult=${inspect(bulkWriteOpResult)}`);
							// _.each(bs, bsDoc => {
							// 	bsDoc._bulkSaveDeferred.resolve(bulkWriteOpResult);
							// 	_.unset(bsDoc, '_bulkSaveDeferred');
							// });
							bsd.resolve(bulkWriteOpResult);
						} else {
							_.each(bulkWriteOpResult.result.writeErrors, writeError => {
								model._stats.bulkSave.errors.push(writeError);
								console.error(`bulkWriteError: ${writeError.stack||writeError}`);
							});
							// _.each(bs, bsDoc => {
							// 	bsDoc._bulkSaveDeferred.reject(bulkWriteOpResult);
							// 	_.unset(bsDoc, '_bulkSaveDeferred');
							// });
							bsd.reject(bulkWriteOpResult);
						}
					}).catch(err => {	
						model._stats.bulkSave.errors.push(err);
						console.error(`bulkWriteError: ${err.stack||err}`);
						// _.each(bs, bsDoc => {
						// 	bsDoc._bulkSaveDeferred.reject(err);
						// 	_.unset(bsDoc, '_bulkSaveDeferred');
						// });
						bsd.reject(err);
					}).done();
				}
			});//.catch(err => reject(err));
		// });

	});

};
