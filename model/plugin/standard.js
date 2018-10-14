"use strict";
const console = require('../../stdio.js').Get('model/plugin/standard', { minLevel: 'verbose' });	// log verbose debug
const util = require('util');
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
mongoose.Promise = Q.Promise;

/* Standard/common schema methods, statics
 */
module.exports = function standardSchemaPlugin(schema, options) {

	console.verbose(`standardSchemaPlugin(): schema=${inspect(schema)}, options=${inspect(options)}, this=${inspect(this)}`);

	schema.plugin(require('./stat.js'), { data: { save: {}, validate: {} } });
	
	schema.pre('validate', function(next) {
		console.debug(`stat: pre('validate')`);//: modelName=${this.constructor.modelName} keys(this.constructor)=${_.keys(this.constructor).join(', ')} keys(this.constructor.prototype)=${_.keys(this.constructor.prototype).join(', ')}`);
		var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
		this.constructor._stats.validate[actionType]++;
		this.constructor._stats.validate.calls++;
		return next();
	});
	schema.post('validate', function(doc, next) {
		console.debug(`stat: post('validate')`);//: modelName=${this.constructor.modelName} keys(this.constructor)=${_.keys(this.constructor).join(', ')} keys(this.constructor.prototype)=${_.keys(this.constructor.prototype).join(', ')}`);
		this.constructor._stats.validate.success++;
		return next();
	});
	schema.post('validate', function(err, doc, next) {
		console.debug(`stat: post('validate') error: ${err.stack||err.message||err}`);
		this.constructor._stats.validate.errors.push(err);
		return next(err);
	});

	schema.pre('save', function(next) {
		console.debug(`stat: pre('save')`);
		var actionType = this.isNew ? 'created' : this.isModified() ? 'updated' : 'checked';
		this.constructor._stats.save[actionType]++;
		this.constructor._stats.save.calls++;
		return next();
	});
	schema.post('save', function(doc, next) {
		console.debug(`stat: post('save')`);
		this.constructor._stats.save.success++;
		return next();
	});
	schema.post('save', function(err, doc, next) {
		console.debug(`stat: post('save') error: ${err.stack||err.message||err}`);
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
			if (schemaType && schemaType.instance === 'Embedded') {
				console.debug(`updateDocument: ${fullPath}: Embedded`);
				this.updateDocument(updVal, fullPath + '.');
			} else if (!_.isEqual(docVal, updVal)) {
				console.debug(`updateDocument: ${fullPath}: Updating ${docVal} to ${updVal}`);
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
	 * That way this plugin overall should work on schemas with discriminators or without, or both (I think) - e.g. FsEntry and File */
	schema.static('findOrCreate', function findOrCreate(query, data, cb) {
		var dk = schema.options.discriminatorKey;
		var model = dk && data[dk] && this.discriminators[data[dk]] ? this.discriminators[data[dk]] : this;
		console.debug(`[model ${this.modelName}(dk=${dk})].findOrCreate(): query=${inspect(query,{compact:true})} data='${inspect(data)}' data[dk]='${data[dk]}': setting model='${/*inspect*/(model.modelName)}'`);
		return Q(model.findOne(query).then(r => r ? r.updateDocument(data) : new (model)(data)));	//new (this)(data)));//this.create(data)));
	});

};
