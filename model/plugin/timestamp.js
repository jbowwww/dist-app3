"use strict";

const console = require('../../stdio.js').Get('model/plugin/timestamp', { minLevel: 'log' });	// log verbose debug
// const inspect = require('./utility.js').makeInspect({ depth: 2, compact: true /* false */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const _ = require('lodash');
const Q = require('q');

module.exports = function timestampSchemaPlugin(schema, options) {
	schema.add({
		_ts: {
		createdAt: { type: Date, required: true/*, default: () => Date.now()*/ },
		checkedAt: { type: Date, required: false },
		updatedAt: { type: Date, required: false },
		deletedAt: { type: Date, required: false }
	} });

	schema.pre('validate', function(next) {
		var model = this.constructor;
		if (!this._ts.createdAt && !this.isNew) {
			return next(new Error(`[model ${model.modelName}].pre('validate')#timestampSchemaPlugin: !doc._ts.createdAt !this.isNew ${this.isModified()?'':'!'}this.isModified()`));
		} else if (this._ts.created && this.isNew) {
			return next(new Error(`[model ${model.modelName}].pre('validate')#timestampSchemaPlugin: doc._ts.createdAt && this.isNew ${this.isModified()?'':'!'}this.isModified()`));
		}
		var now = Date.now();
		if (this.isNew) {
			this._ts.createdAt = this._ts.updatedAt = this._ts.checkedAt = now;
		} else if (this.isModified()) {
			this._ts.updatedAt = this._ts.checkedAt = now;
		} else if (!this._ts.updatedAt) {
			this._ts.checkedAt = now;
		}
		console.verbose(`[model ${model.modelName}].pre('validate')#timestampSchemaPlugin: isNew=${this.isNew} ${this.modifiedPaths().join(' ')}`); //this=${inspectPretty(this.schema)} parent=${inspectPretty(this.$parent)}`);
		return next();
	});

	schema.virtual('isDeleted', function() {
		return this._ts.deletedAt && this._ts.deletedAt <= Date.now();
	});
	
	schema.method('markDeleted', function(timestamp = Date.now()) {
		if (this._ts.deletedAt) { console.warn(`Doc being marked deleted already has deletedAt=${this._ts.deletedAt}`); }
		this._ts.deletedAt = timestamp;
		return Q(this);
	});

	/* Returns true if the timestamps indicate this object is still current relative to given timestamp */
	schema.method('hasUpdatedSince', function(timestamp) {
		return (this._ts.updatedAt && (this._ts.updatedAt >= timestamp))
		 || (this._ts.checkedAt && (this._ts.checkedAt >= timestamp));
	});
};
