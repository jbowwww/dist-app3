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

	options = _.assign({
		maxBatchSize: 10,
		batchTimeout: 750
	}, options);

	console.debug(`bulkSaveSchemaPlugin(): schema=${inspect(schema)}, options=${inspect(options)}`);

	schema.method('bulkSave', function bulkSave(maxBatchSize = 10/*options.maxBatchSize*/, batchTimeout = 750 /*options.batchTimeout*/) {

		var model = this.constructor;
		var doc = this;

		console.debug(`bulkSaveSchemaPlugin(): model.modelName=${model.modelName} doc.isNew=${doc.isNew}`);

		return Q.Promise((resolve, reject, notify) => {
		
			doc.validate().then(() => {
				// model._stats.updateBulkOp(doc, `${model.modelName}.bulkSave`);
					
				var bsOp =
					doc.isNew 								?	{ insertOne: { document: doc.toObject() } }
				: 	doc._id !== null && doc.isModified()	?	{ updateOne: { filter: { _id: doc.get('_id') }, update: { $set: doc } } }	// TODO: should i only be updating the modified fields? (always includes _ts and _ts.checkedAt)
				: 	null;

				if (bsOp === null) {
					console.warn(`${model.modelName}.bulkSave unmodified doc=${inspect(doc._doc)}`);
				} else {
					if (!model._bulkSave) {
						model._bulkSave = [];
					}
					model._bulkSave.push(bsOp);
					if (model._bulkSave.length >= maxBatchSize) {
						if (model._bulkSaveTimeout) {
							clearTimeout(model._bulkSaveTimeout);
						}
						innerBulkSave();
					} else {
						if (!model._bulkSaveTimeout) {
							model._bulkSaveTimeout = setTimeout(innerBulkSave, batchTimeout);
						}
					}
				}
				
				resolve(doc);
				
				function innerBulkSave() {
					var bs = model._bulkSave;
					model._bulkSave = [];
					delete model._bulkSaveTimeout;
					// model._stats.updateBulkOp(bs.length);
					console.debug(`${model.modelName}.bulkWrite([${bs.length}]=${inspect(bs, { depth: 3, compact: true })}`);
					model.bulkWrite(bs)
					// .catch(err => {
					// 	reject(err);
					// 	// model._stats.updateError(err, `${model.modelName}.bulkSave error: ${inspect(err)}`);
					// })
					.then(bulkWriteOpResult => {
						// model._stats.bulkOpSuccess++;
						console.debug(`${model.modelName}.innerBulkSave(): bulkWriteOpResult=${inspect(bulkWriteOpResult)}`);
					}).catch(err => {	
						console.error(`bulkWriteError: ${err.stack||err}`);
						reject(err);
					}).done();
				}
			}).catch(err => reject(err));
		});
	});

};
