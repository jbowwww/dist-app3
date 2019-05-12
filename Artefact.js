"use strict";
const console = require('../../stdio.js').Get('Artefact', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 3, compact: false /* true */ });
const util = require('util');
const _ = require('lodash');
const mongoose = require('mongoose');
// mongoose.set('debug', true);
// const { /*promisePipe,*/ artefactDataPipe, chainPromiseFuncs, iff, tap } = require('../../promise-pipe.js');

module.exports = Artefact;

function Artefact() {
	if (!(this instanceof Artefact)) {
		return new Artefact(arguments);
	} else if (arguments.length < 1) {
		throw new TypeError(`Argument constructor must take at least one argument; a document or a document-returning function`);
	}

	if (arguments[0] instanceof Function) {

		// arguments[0] should return a mongoose document.
		// This will return a wrapper function that calls getArtefact() on the returned document
		// (how to pass parameter to original function?)

	} else if (arguments[0] instanceof Object) {

		// object should be a mongoose document
		// THis will return document.getArtefact()

	} else {
		throw new TypeError(`Argument constructor argument must be a document or a document-returning function`);
	}
}