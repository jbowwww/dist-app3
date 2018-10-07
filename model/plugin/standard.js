"use strict";
const console = require('../../stdio.js').Get('model/plugin/find-or-create', { minLevel: 'verbose' });	// log verbose debug
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

	schema.static('findOrCreate', function findOrCreate(query, data, cb) {
		return Q(this.findOne(query).then(r => r ? r.updateDocument(data) : this.create(data)));
	});

};
