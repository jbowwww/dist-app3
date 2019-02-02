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
// const Fs = require('./index.js');//mongoose.model('partition');// require('./partition.js');
// const { Partition } = Fs;

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
// disk.plugin(require('../plugin/bulk-save.js'));
disk.plugin(require('../plugin/artefact.js'));
// dosk.plugin(require('../plugin/stat.js'), { data: { save: {}, validate: {}, bulkSave: {}, ensureCurrentHash: {} } });

var disks = [], partitions = [];

disk.static('findOrPopulate', function findOrPopulate() {
	
	const Partition = mongoose.model('partition');

	var model = this;
	var debugPrefix = `[model ${model.modelName}].findOrPopulate()`;

	var dbOpt = { saveImmediate: true };

	return getDevices()
	.then(jsonDevices => { console.verbose(`${debugPrefix}: jsonDevices=${inspect(jsonDevices)}`); return jsonDevices;})

	.then(jsonDevices => Q.all(_.map(jsonDevices, disk =>
		model.findOrCreate(disk, dbOpt)
		.then(diskDoc => (function mapPartitions(container, containerPartitionDoc) {
			disks.push(diskDoc);
			return !container || !container.children ? Q(null) : Q.all(_.map(container.children, partition => 
				Partition.findOrCreate(_.assign(partition, { disk: diskDoc, container: containerPartitionDoc}), dbOpt)
				.tap(partitionDoc => partitions.push(partitionDoc))
				.tap(partitionDoc => console.verbose(`partitionDoc=${inspect(partitionDoc)}`))		// diskDoc=${inspect(diskDoc)} containerPartitionDoc=${inspect(containerPartitionDoc)} 
				.then(partitionDoc => mapPartitions(partition, partitionDoc)) )); 
		})(disk))
	)))
	
	// these collections should be relatively small, and will be referred to by all fsEntry objects, so cache locally
	// .then(() => Q.all([
	// 	model.find({}).then(_disks => disks = _disks),
	// 	Partition.find({}).then(_partitions => partitions = _partitions)
	// ]))
	.then(() => {
		console.verbose(`${debugPrefix}: devices[${disks.length}] = ${inspect(disks)}\n`
		 + `partitions[${partitions.length}] = ${inspect(partitions.length)}`);
	})

	.catch(e => {
		console.error(`disk.findOrPopulate: error: ${e.stack||e}`);
		model._stats.errors.push(err);
		throw e;
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
