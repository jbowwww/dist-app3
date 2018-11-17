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
// const getDevices = require('../../fs/devices.js');
const { drives, drivesDetail } = promisifyMethods(require('nodejs-disks'));
const Partition = require('./partition.js');

let disk = new mongoose.Schema({
	// serial: { type: String, required: true },
	// model: { type: String, required: true },
	// label: { type: String, required: true },
	used: { type: String, required: true },
	available: { type: String, required: true },
	freePer: { type: String, required: true },
	usedPer: { type: String, required: true },
	total: { type: String, required: true },
	drive: { type: String, required: true },
	// device: { type: String, required: true },
	mountpoint: { type: String, required: true, unique: true },
	// children: [{type: Partition.schema, required: true }]
});

disk.plugin(require('../plugin/standard.js'));
disk.plugin(require('../plugin/bulk-save.js'));
// disk.on('init', model => {
	
// });

disk.static('findOrPopulate', function findOrPopulate() {
	console.verbose(`findOrPopulate: this=${inspect(this)}`);
	return drives().then(d => drivesDetail(d)).then(details => {
		console.verbose(`disk.on('init').details=${inspect(details)}`);
		return Q.all(_.map(_.uniqBy(details, 'mountpoint'), detail =>
			this.findOrCreate({ mountpoint: detail.mountpoint }, detail)
			.then(disk => disk./*save*/ bulkSave ())));
	}).catch(err => {
		console.error(`disk.on('init').drives: error: ${err.stack||err}`);
		throw err;
	});
});

disk.static('getDriveForPath', function getDriveForPath(path) {
	console.log(`getDriveForPath('${path}'): this=${this}`);
	return this.find().then(disks => {
		var disk =_.find( _.sortBy( disks, disk => disk.mountpoint.length ), disk => path.startsWith(disk.mountpoint));
		console.log(`disk=${inspect(disk)} disks=${inspect(disks)}`);
		return disk;
	});
})
module.exports = mongoose.model('disk', disk);
