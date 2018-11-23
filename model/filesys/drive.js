"use strict";
const console = require('../../stdio.js').Get('model/filesys/drive', { minLevel: 'verbose' });	// log verbose debug
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
const { drives, drivesDetail } = promisifyMethods(require('nodejs-drives'));
const Partition = require('./partition.js');

let drive = new mongoose.Schema({
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

drive.plugin(require('../plugin/standard.js'));
drive.plugin(require('../plugin/bulk-save.js'));
// drive.on('init', model => {
	
// });

drive.static('findOrPopulate', function findOrPopulate() {
	return drives()
	.then(drives => drivesDetail(drives)
		.tap(disks => console.verbose(`drives=${inspect(drives)} disks=${inspect(disks)}`))
		.then(disks => Q.all(_.map(_.uniqBy(disks, 'mountpoint'), disk =>
			this.findOrCreate({ mountpoint: disk.mountpoint }, disk)
			.then(disk => disk./*save*/ bulkSave() )))))
	.tapError(err => console.error(`drive.on('init').drives: error: ${err.stack||err}`));
});

drive.static('getDriveForPath', function getDriveForPath(path) {
	return this.find()
	.then(drives => {
		var drive =_.find( _.sortBy( drives, drive => drive.mountpoint.length ), drive => path.startsWith(drive.mountpoint));
		console.log(`drive=${inspect(drive)} drives=${inspect(drives)}`);
		return drive;
	});
})
module.exports = mongoose.model('drive', drive);
