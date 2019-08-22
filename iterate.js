"use strict";

const log = require('debug')('Event');
const pMap = require('p-map');
const pProgress = require('p-progress');
const pCancelable = require('p-cancelable');

module.exports = function iterate(iterable, mapFn, options = {}) {
	options = { concurrency: 1, stopOnError: true, ...options };
	return pMap(iterable, mapFn, options);
	function mapFn(
};
