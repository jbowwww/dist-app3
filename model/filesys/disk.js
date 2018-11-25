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

const getDevices = require('../../fs/devices.js');
// const { drives, drivesDetail } = promisifyMethods(require('nodejs-disks'));
const Drive = require('./drive.js');

let disk = new mongoose.Schema({
	name: { type: String, required: true },
	serial: { type: String, required: false }, //true, default: '' },
	model: { type: String, required: false }, //true, default: '' },
	label: { type: String, required: false }, //true, default: '' },
	uuid: { type: String, required: false }, //true, default: '' },
	size: { type: String, required: false }, //true, default: '' },
	vendor: { type: String, required: false }, //true, default: '' },
	// children: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'drive' }]
});

disk.plugin(require('../plugin/stat.js'));
disk.plugin(require('../plugin/standard.js'));
disk.plugin(require('../plugin/bulk-save.js'));

disk.static('findOrPopulate', async function findOrPopulate() {
	var disks = await getDevices();
	console.verbose(`disks=${inspect(disks)}`);
	try {
		return await Q.all(_.map(disks, disk =>
			this.findOrCreate({ name: disk.name, vendor: disk.vendor, model: disk.model, serial: disk.serial }, disk, { saveImmediate: true })
			.tap(diskDoc => console.verbose(`diskDoc=${inspect(diskDoc)}`))
			.tap(diskDoc => Q.all(_.map(disk.children, drive =>
				Drive.findOrCreate(/*drive*/{
					name: drive.name,
					uuid: drive.uuid,
					// label: drive.label,
					// fstype: drive.fstype,
					// model: drive.model,
					// serial: drive.serial,
					// parttype: drive.parttype
				}, _.set(drive, 'disk', diskDoc), { saveImmediate: true })
				.tap(driveDoc => console.verbose(`diskDoc=${inspect(diskDoc)} driveDoc=${inspect(driveDoc)}`)))))
				// .tap(drive => drive.save()))))
			// .tap(d => d.save())
				// .tap(() => console.verbose(`disk=${inspect(d)}`))
			));
	} catch (e) {
		console.error(`disk.findOrPopulate: error: ${e.stack||e}`);
		throw e;
	}
});

disk.static('getDriveForPath', function getDriveForPath(path) {
	return this.find()
	.then(disks => {
		var disk =_.find(_.sortBy(
			_.filter(disks, disk => typeof disk.mountpoint === 'string'),
			disk => disk.mountpoint.length ), disk => path.startsWith(disk.mountpoint));
		console.verbose(`disk=${inspect(disk)} disks=${inspect(disks)}`);
		return disk;
	});
})
module.exports = mongoose.model('disk', disk);
