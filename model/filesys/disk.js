"use strict";
const console = require('../../stdio.js').Get('model/filesys/disk', { minLevel: 'log' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 3, compact: false /* true */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const { promisifyMethods } = require('../../utility.js');
const util = require('util');
const _ = require('lodash');
const hashFile = require('../../fs/hash.js');
const mongoose = require('mongoose');
const Q = require('q');
const getDevices = require('../../fs/devices.js');
const { Partition } = require('./index.js');//mongoose.model('partition');// require('./partition.js');

let disk = new mongoose.Schema({
	name: { type: String, required: true },
	serial: { type: String, required: false }, //true, default: '' },
	model: { type: String, required: false }, //true, default: '' },
	label: { type: String, required: false }, //true, default: '' },
	uuid: { type: String, required: false }, //true, default: '' },
	size: { type: String, required: false }, //true, default: '' },
	vendor: { type: String, required: false }, //true, default: '' },
	// children: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'partition' }]
}, {
	// strict: false,
	defaultFindQuery: ['name', 'vendor', 'model', 'serial']//{ uuid: undefined }
});

disk.plugin(require('../plugin/custom-hooks.js'));
disk.plugin(require('../plugin/timestamp.js'));
disk.plugin(require('../plugin/standard.js'));
disk.plugin(require('../plugin/bulk-save.js'));
disk.plugin(require('../plugin/artefact.js'));
// dosk.plugin(require('../plugin/stat.js'), { data: { save: {}, validate: {}, bulkSave: {}, ensureCurrentHash: {} } });

disk.static('findOrPopulate', function findOrPopulate() {
	return getDevices().then(disks => {
		console.verbose(`disks=${inspect(disks)}`);
		return Q.all(_.map(disks, disk => this.findOrCreate(disk, { saveImmediate: true })
			.then(diskDoc => (function mapPartitions(container, containerPartitionDoc) {
				return Q.all(_.map(container.children, partition => {
					_.assign(partition, { disk: diskDoc, container: containerPartitionDoc/*Id*/ });
					return Partition.findOrCreate(partition, { saveImmediate: true })
						.tap(partitionDoc => console.verbose(`diskDoc=${inspect(diskDoc)} partitionDoc=${inspect(partitionDoc)} containerPartitionDoc=${inspect(containerPartitionDoc)}`))
						.then(partitionDoc => mapPartitions(partition, partitionDoc));;
				}));
			})(disk))
		))
		.catch(e => {
			console.error(`disk.findOrPopulate: error: ${e.stack||e}`);
			throw e;
		});
	});
});

disk.static('getPartitionForPath', function getPartitionForPath(path) {
	return this.find().then(disks => {
		var disk =_.find(_.sortBy(
				_.filter(disks, disk => typeof disk.mountpoint === 'string'),
				disk => disk.mountpoint.length ),
			disk => path.startsWith(disk.mountpoint));
		console.verbose(`disk=${inspect(disk)} disks=${inspect(disks)}`);
		return disk;
	});
})

module.exports = mongoose.model('disk', disk);
