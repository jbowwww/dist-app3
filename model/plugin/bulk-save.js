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

	// console.debug(`bulkSaveSchemaPlugin(): `);//schema=${inspect(schema)}, options=${inspect(options)}`);

	schema.method('bulkSave', function bulkSave(maxBatchSize = options.maxBatchSize, batchTimeout = options.batchTimeout) {

		var model = this.constructor;
		var doc = this;

		console.debug(`bulkSave(): model.modelName=${model.modelName} doc.isNew=${doc.isNew}`);

		return Q.Promise((resolve, reject, notify) => {
		
			doc.validate().then(() => {
					
				var bsOp =
					doc.isNew 								?	{ insertOne: { document: doc.toObject() } }
				: 	doc._id !== null && doc.isModified()	?	{ updateOne: { filter: { _id: doc.get('_id') }, update: { $set: doc } } }	// TODO: should i only be updating the modified fields? (always includes _ts and _ts.checkedAt)
				: 	null;

				if (bsOp === null) {
					model._stats.bulkSave.items.unmodified++;
					console.warn(`${model.modelName}.bulkSave unmodified doc=${inspect(doc._doc)}`);
				} else {
					model._stats.bulkSave.items[_.keys(bsOp)[0]]++;
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

					// 181008: I think I need to put most, if not all of these plugins' functionality back into the one plugin. They're too tghtly coupled,
					// Especially if you want to have meaningful _stats values
					model._stats.bulkSave.calls++;
					
					var bs = model._bulkSave;
					model._bulkSave = [];
					delete model._bulkSaveTimeout;
					console.debug(`${model.modelName}.bulkWrite([${bs.length}]=${inspect(bs, { depth: 3, compact: true })}`);
					
					model.bulkWrite(bs).then(bulkWriteOpResult => {
						model._stats.bulkSave.success++;
						console.debug(`${model.modelName}.innerBulkSave(): bulkWriteOpResult=${inspect(bulkWriteOpResult)}`);
					}).catch(err => {	
						model._stats.bulkSave.errors.push(err);
						console.error(`bulkWriteError: ${err.stack||err}`);
						reject(err);
					}).done();
				}
			}).catch(err => reject(err));
		});
	});



	schema.pre('bulkWrite', function(next) {
		console.verbose(`  !!!!!!!!      stat: pre('bulkWrite')`);
		// this.constructor._stats.bulkSave.calls++;
		return next();
	});
	
	schema.pre('bulkSave', function(next) {
		console.verbose(`stat: pre('bulkSave')`);
		// this.constructor._stats.bulkSave.calls++;
		return next();
	});
	schema.post('bulkSave', function(doc, next) {
		console.verbose(`stat: post('bulkSave')`);
		// this.constructor._stats.bulkSave.success++;
		return next();
	});
	schema.post('bulkSave', function(err, doc, next) {
		console.verbose(`stat: post('bulkSave') error: ${err.stack||err.message||err}`);
		// this.constructor._stats.bulkSave.errors.push(err);
		return next(err);
	});
};
