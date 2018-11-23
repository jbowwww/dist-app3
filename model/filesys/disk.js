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
	drives: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'drive', alias: 'children' }]
});

disk.plugin(require('../plugin/stat.js'));
disk.plugin(require('../plugin/standard.js'));
disk.plugin(require('../plugin/bulk-save.js'));

disk.static('findOrPopulate', async function findOrPopulate() {
	var disks = await getDevices();
	console.verbose(`disks=${inspect(disks)}`);
	try {
		return await Q.all(_.map(disks, d =>
			this.findOrCreate({ name: d.name, vendor: d.vendor, model: d.model, serial: d.serial }, d)
			.tap(d => console.verbose(`disk=${inspect(d)}`))
			.tap(d => Q.all(_.map(d.children, drive =>
				Drive.findOrCreate({
					name: drive.name,
					uuid: drive.uuid,
					label: drive.label,
					fstype: drive.fstype,
					model: drive.model,
					serial: drive.serial,
					parttype: drive.parttype
				}, _.set(drive, 'disk', d))))
				.tap(() => d.save())
				// .tap(() => console.verbose(`disk=${inspect(d)}`))
			)));
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
