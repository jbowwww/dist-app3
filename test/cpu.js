
"use strict";
const util = require('util');
const _ = require('lodash');
// const pMap = require('p-map');
// const pAll = require('p-all');
// const hashFile = require('./fs/hash.js');
// const fs = require('fs');
// const fsIterate = require('./fs/iterate.js').iterate;

const os = require('os');

// console.log(util.inspect(_(os).map(prop => !!prop && typeof os[prop] === 'valtion' && os[prop].length <= 1 ? os[prop]() : undefined)));

for (let prop in os) {
	let val = os[prop];
	if (typeof val === 'function' && val.length <= 1) {
		let result = val();
		console.log(`${prop}: ${val.name}(): ${util.inspect(result)}`);
	} else {
		console.log(`${prop}: ${util.inspect(val)}`);
	}
}
