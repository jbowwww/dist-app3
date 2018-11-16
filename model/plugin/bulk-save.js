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
		
	schema.method('bulkSave', function bulkSave(options) {

		var model = this.constructor;
		var doc = this;

		options = _.assign({
			maxBatchSize: 10,
			batchTimeout: 750
		}, options);

		console.debug(`[model ${model.modelName}].bulkSave(): isNew=${doc.isNew} isModified()=${doc.isModified()} modifiedPaths=${doc.modifiedPaths}`);

		return Q.Promise((resolve, reject, notify) => {
			doc.validate().then(() => {
				
				// insert, update, or do nothing depending if the doc is new, updated or unmodified
				var actionType = doc.isNew ? 'created' : /*doc._id !== null && */doc.isModified() ? 'updated' : 'checked';
				model._stats.bulkSave[actionType]++;
				model._stats.bulkSave.calls++;
				if (actionType === 'checked') {
					model._stats.bulkSave.success++;
					console.debug(`[model ${model.modelName}].bulkSave unmodified doc=${inspect(doc._doc)}`);
					return resolve(doc);
				} else if (actionType === 'created') {
					var bsOp = { op: { insertOne: { document: doc.toObject() } }, resolve() { doc.isNew = false; }, doc: doc };
				} else { //if (actionType === 'updated') {
					var bsOp = { op: { updateOne: { filter: { _id: doc.get('_id') }, update: { $set: doc.toObject() } } }, doc: doc };
				}
				
				// batches of documents written when either options.maxBatchSize is reached or options.batchTimeout elapses
				if (!model._bulkSave) {
					model._bulkSave = [];
				}
				model._bulkSave.push(bsOp);
				if (model._bulkSave.length >= options.maxBatchSize) {
					if (model._bulkSaveTimeout) {
						clearTimeout(model._bulkSaveTimeout);
						delete model._bulkSaveTimeout;
					}
					innerBulkSave();
				} else if (!model._bulkSaveTimeout) {
					model._bulkSaveTimeout = setTimeout(innerBulkSave, options.batchTimeout);
				}

				// resolves the return promise with the document queued for bulk writing, although it is not written yet
				resolve(doc);
				
				// Perform actual bulk save
				function innerBulkSave() {
					var bs = (model._bulkSave);
					model._bulkSave = [];
					console.verbose(`[model ${model.modelName}].bulkWrite([${bs.length}]=${inspect(bs.map(bsEntry => bsEntry.op), { depth: 3, compact: true })}`);
					model.bulkWrite(_.map(bs, bsEntry => bsEntry.op)).then(bulkWriteOpResult => {
						if (bulkWriteOpResult.result.ok) {
							model._stats.bulkSave.success += bulkWriteOpResult.result.nModified;
							console.debug(`[model ${model.modelName}].innerBulkSave(): bulkWriteOpResult=${inspect(bulkWriteOpResult)}`);
						} else {
							_.each(bulkWriteOpResult.result.writeErrors, writeError => {
								model._stats.bulkSave.errors.push(writeError);
								console.error(`bulkWriteError: ${writeError.stack||writeError}`);
							});
						}
					}).catch(err => {	
						model._stats.bulkSave.errors.push(err);
						console.error(`bulkWriteError: ${err.stack||err}`);
					}).done();
				}
			}).catch(err => reject(err));
		});

	});

};
