"use strict";
const console = require('../../stdio.js').Get('model/filesys/disk', { minLevel: 'log' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const { promisifyMethods } = require('../../utility.js');
const util = require('util');
const _ = require('lodash');
const hashFile = require('../../fs/hash.js');
const mongoose = require('mongoose');
const Q = require('q');
const getDevices = require('../../fs/devices.js');
// const { partitions, partitionsDetail } = promisifyMethods(require('nodejs-disks'));
const Partition = require('./partition.js');

let disk = new mongoose.Schema({
	name: { type: String, required: true },
	serial: { type: String, required: false }, //true, default: '' },
	model: { type: String, required: false }, //true, default: '' },
	label: { type: String, required: false }, //true, default: '' },
	uuid: { type: String, required: false }, //true, default: '' },
	size: { type: String, required: false }, //true, default: '' },
	vendor: { type: String, required: false }, //true, default: '' },
	// children: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'partition' }]
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
			.tap(diskDoc => Q.all((function mapPartitions(container, containerPartitionDoc/*Id*/) {
				return /*!container ? [] :*/ _.map(container.children, partition =>
				Partition.findOrCreate(/*partition*/{
					name: partition.name,
					uuid: partition.uuid,
					container: containerPartitionDoc/*Id*/ //? containerPartitionId : undefined
					// label: partition.label,
					// fstype: partition.fstype,
					// model: partition.model,
					// serial: partition.serial,
					// parttype: partition.parttype
				}, _.assign(partition, {
					disk: diskDoc,
					container: containerPartitionDoc/*Id*/
				}), { saveImmediate: true })
				.tap(partitionDoc => console.verbose(`diskDoc=${inspect(diskDoc)} partitionDoc=${inspect(partitionDoc)} containerPartitionDoc=${inspect(containerPartitionDoc)}`))
				.then(partitionDoc => Q.all(mapPartitions(partition, partitionDoc/*._id*/)))
				);
			})(disk)))
			// .catch(e => { throw e; })
		));
	} catch (e) {
		console.error(`disk.findOrPopulate: error: ${e.stack||e}`);
		throw e;
	}
});

disk.static('getPartitionForPath', function getPartitionForPath(path) {
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
