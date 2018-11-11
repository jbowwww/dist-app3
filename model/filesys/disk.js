"use strict";
const console = require('../../stdio.js').Get('model/filesys/disk', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const { promisifyMethods } = require('../../utility.js');
const util = require('util');
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const hashFile = require('../../fs/hash.js');
const mongoose = require('../../mongoose.js');
const getDevices = require('../../fs/devices.js');
const { drives, drivesDetails } = promisifyMethods(require('nodejs-disks'));
const Partition = require('./partition.js');

let disk = new mongoose.Schema({
	serial: { type: String, required: true },
	model: { type: String, required: true },
	label: { type: String, required: true },
	device: { type: String, required: true },
	mountPoint: { type: String, required: true },
	children: [{type: Partition.schema, required: true }]
});

disk.plugin(require('../plugin/stat.js'));

disk.on('init', model => {
	getDevices().then(devices => {
		// console.verbose(`disk.on('init').getDevices(): devices=${inspect(devices)}`);
		Object.defineProperty(model, 'devices', { enumerable: true, value: _.map(devices.blockdevices, device => new (model)(device)) });
		var reducePartitions = devices =>_.reduce(_.map(devices, device => device.children),
			(result, value, key) => result = /*_.flatMap*/(_.concat(result, value, reducePartitions(value))),
			[] );
		var partitions = reducePartitions(devices.blockdevices);
		Object.defineProperty(Partition, 'partitions', { enumerable: true, value: partitions });	//() { return _.concat(); } });
		console.verbose(`disk.on('init').getDevices(): model.devices=${inspect(model.devices)} Partition.partitions=${inspect(Partition.partitions)}`);
	}).catch(err => {
		console.error(`disk.on('init').getDevices(): error: ${err.stack||err}`);
	});//.done();
});

module.exports = mongoose.model('disk', disk);
