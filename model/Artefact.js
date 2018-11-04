"use strict";
const console = require('../stdio.js').Get('model/artefact.js', { minLevel: 'log' });	// log verbose debug
const util = require('util');
const inspect = require('../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
mongoose.Promise = Q.Promise;

function Artefact(obj) {
	if (!(this instanceof Artefact)) {
		return new Artefact(obj);
	}
	var r = _.assign(this, obj);
	console.verbose(`Artefact.ctor: obj=${inspect(obj)}, this=${inspect(this)}`);
};

Artefact.prototype.bulkSave = function bulkSave(opts) {
	opts = _.assign({
		maxBatchSize: 10,
		batchTimeout: 750
	}, opts);
	console.verbose(`Artefact.bulkSave(opts=${inspect(opts, { compact: true })}: ${inspect(this, { compact: false })}`);
	return Q.all(
		_.map(this, (data, dataName) => data.bulkSave(opts.meta && opts.meta[dataName] ? opts.meta[dataName] : opts))
	)
	.then(() => this);
};

module.exports = Artefact;
