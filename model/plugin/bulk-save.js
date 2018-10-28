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

	schema.plugin(require('./stat.js'), {
		data: {
			bulkSave: {
				items: {
					insertOne: 0, updateOne: 0, insertMany: 0, updateMany: 0, unmodified: 0,
					get total() { return this.insertOne + this.updateOne + this.insertMany + this.updateMany + this.unmodified/* + this.inserts + this.updates*/; }
					// toString() { return util.inspect(this, { compact: true }); }
				}
			}
		}
	});

		
	schema.method('bulkSave', function bulkSave(options) { //maxBatchSize = options.maxBatchSize, batchTimeout = options.batchTimeout) {

		var model = this.constructor;
		var doc = this;

		options = _.assign({
			maxBatchSize: 10,
			batchTimeout: 750
		}, options);

		console.debug(`bulkSave(): model.modelName=${model.modelName} doc.isNew=${doc.isNew}`);

		var actionType = doc.isNew ? 'created' : doc.isModified() ? 'updated' : 'checked';
		model._stats.bulkSave[actionType]++;
		model._stats.bulkSave.calls++;

		return Q.Promise((resolve, reject, notify) => {
			doc.validate().then(() => {
					
				var bsOp = null;
				if (doc.isNew) {
					bsOp = { insertOne: { document: doc.toObject() } };
				} else if (doc._id !== null && doc.isModified()) {
					bsOp = { updateOne: { filter: { _id: doc.get('_id') }, update: { $set: doc.toObject() } } };
				} else {
					model._stats.bulkSave.items.unmodified++;
					model._stats.bulkSave.success++;
					console.debug(`${model.modelName}.bulkSave unmodified doc=${inspect(doc._doc)}`);
				}

				if (bsOp) {
					model._stats.bulkSave.items[_.keys(bsOp)[0]]++;
					if (!model._bulkSave) model._bulkSave = [];
					model._bulkSave.push({ op: bsOp, resolve: resolve.bind(this, doc), reject });
					if (model._bulkSave.length >= options.maxBatchSize) {
						process.nextTick(() => innerBulkSave());
					} else if (!model._bulkSaveTimeout) {
						model._bulkSaveTimeout = setTimeout(innerBulkSave, options.batchTimeout);
					}
				}				
				resolve(doc);
				
				function innerBulkSave() {
					var bs = model._bulkSave;
					model._bulkSave = [];
					if (model._bulkSaveTimeout) {
						clearTimeout(model._bulkSaveTimeout);
						delete model._bulkSaveTimeout;
					}
					// console.debug(`${model.modelName}.bulkWrite([${bs.length}]=${inspect(bs.map(bsEntry => bsEntry.op), { depth: 3, compact: true })}`);
					model.bulkWrite(bs.map(bsEntry => 	bsEntry.op)).then(bulkWriteOpResult => {
						if (bulkWriteOpResult.result.ok) {
							model._stats.bulkSave.success += bulkWriteOpResult.result.nModified;
							console.debug(`${model.modelName}.innerBulkSave(): bulkWriteOpResult=${inspect(bulkWriteOpResult)}`);
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
