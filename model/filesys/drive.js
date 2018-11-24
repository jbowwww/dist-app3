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
// const { drives, drivesDetail } = promisifyMethods(require('nodejs-drives'));
// const Partition = require('./partition.js');

let drive = new mongoose.Schema({
	disk: { type: mongoose.SchemaTypes.ObjectId, ref: 'disk' },
	name: { type: String, required: true },
	fstype: { type: String, required: true },
	label: { type: String, required: true, default: '' },
	uuid: { type: String, required: true, default: '' },
	parttype: { type: String, required: true, default: '' },
	partlabel: { type: String, required: true, default: '' },
	partuuid: { type: String, required: true },
	mountpoint: { type: String, required: true },
	size: { type: String, required: true },
});

drive.plugin(require('../plugin/stat.js'));
drive.plugin(require('../plugin/standard.js'));
drive.plugin(require('../plugin/bulk-save.js'));


function diskNameFromDrive(diskName) {
	if (typeof diskName === 'string') {
		for (var i = diskName.length; i > 0; i--) {
			if (_.isNumber(diskName[i - 1])) {
				diskName = diskName.slice(i - 1, 1);
			}
		}
	}
};

drive.post('construct', function construct(drive) {
	var model = this;
	const Disk = mongoose.model('disk');
	return Disk.findOrCreate({ name: diskNameFromDrive(drive.name) })
	.then(disk => _.set(drive, 'disk', disk))
	.then(() => { console.verbose(`[model ${model.modelName}].post('construct'): name='${drive.name}' disk=${drive.disk}`) })
	.catch(err => { this.constructor._stats.errors.push(err); throw err; });
});


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
});

module.exports = mongoose.model('drive', drive);
