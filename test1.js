"use strict";
const inspect = require('./utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('./utility.js').makeInspect({ depth: 8, compact: false });
const { promisifyMethods } = require('./utility.js');
const util = require('util');
const _ = require('lodash');
const Q = require('q');
const hashFile = require('./fs/hash.js');
// const Q = mongoose.Promise;

const getDevices = require('./fs/devices.js');
// const { drives, drivesDetail } = promisifyMethods(require('nodejs-disks'));
// const Partition = require('./partition.js');

getDevices().then(devices => {
	console.log(`devices=${inspectPretty(devices)}`);
})