"use strict";
const console = require('../../stdio.js').Get('model/filesys/drive', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const { promisifyMethods } = require('../../utility.js');
const util = require('util');
const _ = require('lodash');
const Q = require('q');
const hashFile = require('../../fs/hash.js');
const mongoose = require('mongoose');

let drive = new mongoose.Schema({
	disk: { type: mongoose.SchemaTypes.ObjectId, ref: 'disk', required: true },				// the disk containing this drive/partition
	container: { type: mongoose.SchemaTypes.ObjectId, ref: 'drive', required: false },		// container partition (e.g. LVM)
	name: { type: String, required: true },													// partition name
	fstype: { type: String, required: true },												// filesystem type
	label: { type: String, required: false, default: '' },									// filesystem label
	uuid: { type: String, required: true, default: '' },									// filesystem(?) uuid
	parttype: { type: String, required: false, default: '' },								// partition type
	partlabel: { type: String, required: false, default: '' },								// partition label
	partuuid: { type: String, required: false },											// partition UUID
	mountpoint: { type: String, required: false },											// parttion mountpoint
	size: { type: String, required: true },													// partition size
});

drive.plugin(require('../plugin/stat.js'));
drive.plugin(require('../plugin/standard.js'));
drive.plugin(require('../plugin/custom-hooks.js'));
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
	return Q(drive.disk instanceof mongoose.Document ? null
	 : 	Disk.findOrCreate({ name: diskNameFromDrive(drive.name) })
		.then(disk => _.set(drive, 'disk', disk)))
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
	.catch(err => { console.error(`drive.on('init').drives: error: ${err.stack||err}`); throw err; });
});

drive.static('getDriveForPath', function getDriveForPath(path) {
	return this.find().then(drives => {
		var drive =_.find( _.sortBy( drives, drive => drive.mountpoint.length ), drive => path.startsWith(drive.mountpoint));
		console.log(`drive=${inspect(drive)} drives=${inspect(drives)}`);
		return drive;
	});
});

module.exports = mongoose.model('drive', drive);
