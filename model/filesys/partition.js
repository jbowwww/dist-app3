"use strict";
const console = require('../../stdio.js').Get('model/filesys/partition', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const util = require('util');
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const hashFile = require('../../fs/hash.js');
const mongoose = require('../../mongoose.js');
const getDevices = require('../../fs/devices.js');
const Disk = require('./disk.js');

let partition = new mongoose.Schema({
	// disk: { type: Disk.schema },
	label: { type: String, required: true },
	device: { type: String, required: true },
	mountPoint: { type: String, required: true }
});

partition.plugin(require('../plugin/stat.js'));

// partition.on('init', model => {
// 	console.verbose(`partition.on('init'): Disk.devices=${inspect(Disk.devices)}`);
// 	Object.defineProperty(model, 'partitions', { enumerable: true, get() { return _.concat(_.map(Disk.devices || [], device => device.children)); } });
// 	console.verbose(`partition.on('init') Partition.partitions=${inspect(model.partitions)}`);
// });

module.exports = mongoose.model('partition', partition);
