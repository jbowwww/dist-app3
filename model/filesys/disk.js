"use strict";
const console = require('../../stdio.js').Get('model/filesys/disk', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const { promisifyMethods } = require('../../utility.js');
const util = require('util');
const _ = require('lodash');
// const Q = require('../../q.js');
const hashFile = require('../../fs/hash.js');
const mongoose = require('../../mongoose.js');
const Q = mongoose.Promise;
// console.verbose(`Q.Promise: ${inspect(Q.Promise)}`);

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

disk.static('findOrPopulate', function findOrPopulate() {
	return drives()
	.tap(drives => console.verbose(`drives=${inspect(drives)}`))
	.then(drives => drivesDetail(drives)
		.tap(disks => console.verbose(`drives=${inspect(drives)} disks=${inspect(disks)}`)))
	.then(disks => Q.all(_.map(_.uniqBy(disks, 'mountpoint'), disk =>
		this.findOrCreate({ mountpoint: disk.mountpoint }, disk)
		.then(disk => disk.save /*bulkSave*/() ))))
	// .catch(err =>
	.tapError(err =>
	 console.error(`disk.findOrPopulate: error: ${err.stack||err}`));
});

disk.static('getDriveForPath', function getDriveForPath(path) {
	return this.find()
	.then(disks => {
		var disk =_.find( _.sortBy( disks, disk => disk.mountpoint.length ), disk => path.startsWith(disk.mountpoint));
		console.verbose(`disk=${inspect(disk)} disks=${inspect(disks)}`);
		return disk;
	});
})
module.exports = mongoose.model('disk', disk);
