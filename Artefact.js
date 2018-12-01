"use strict";
const console = require('./stdio.js').Get('artefact.js', { minLevel: 'log' });	// log verbose debug
const inspect = require('./utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const _ = require('lodash');
// const Q = require('q');
// Q.longStackSupport = true;
const mongoose = require('mongoose');
// mongoose.Promise = Q.Promise;

function Artefact(rootData) {
	if (!rootData || (!rootData.then && (!(rootData instanceof mongoose.Document)))) {
		throw new TypeError(`rootData cannot be undefined, must be a mongoose document or a promise for one`);
	}
	console.verbose(`Artefact.ctor: rootData=${inspect(rootData)}}`);
	return rootData.getArtefact ? rootData.getArtefact() : rootData
	 	.tap (root => console.verbose(`rootData.then(): root=${inspect(root)}\nrootData=${inspect(rootData)}`))
		.then(root => root.getArtefact());
}

module.exports = Artefact;
