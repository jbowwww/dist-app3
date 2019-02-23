"use strict";
const console = require('../../stdio.js').Get('model/filesys/disk', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 3, compact: false /* true */ });
const { promisifyMethods } = require('../../utility.js');
const _ = require('lodash');
const mongoose = require('mongoose');
// const Q = require('q');
const pMap = require('p-map');
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

disk.plugin(require('../plugin/standard.js'));
disk.plugin(require('../plugin/bulk-save.js'));
disk.plugin(require('../plugin/artefact.js'));
// disk.plugin(require('../plugin/stat.js'), [ 'findOrPopulate' ]);

disk.static('findOrPopulate', async function findOrPopulate(task) {
	
	var model = this;
	var debugPrefix = `[model ${model.modelName}].findOrPopulate()`;
	var dbOpt = { saveImmediate: true };

	var pr = getDevices();
	console.log(`getDevices: pr=${inspect(pr)}`);
	let jsonDevices = await pr;// getDevices();
	console.verbose(`${debugPrefix}: jsonDevices=${inspect(jsonDevices)}`);
	try {
		task.progress.max = jsonDevices.length;
		await pMap(jsonDevices, async disk => {
			let diskDoc = await model.findOrCreate(disk, dbOpt);
			await (async function mapPartitions(container, containerPartitionDoc) {
				if (container && container.children) {
					task.progress.max += container.children.length;
				}
				return (!container || !container.children ? null
				 : 	await pMap(container.children, async partition => {
					 	_.assign(partition, { disk: diskDoc, container: containerPartitionDoc });
					 	let partitionDoc = await Partition.findOrCreate(partition, dbOpt);
						console.verbose(`partitionDoc=${inspect(partitionDoc)}`);	// diskDoc=${inspect(diskDoc)} containerPartitionDoc=${inspect(containerPartitionDoc)} 
						var mp = await mapPartitions(partition, partitionDoc);
						task.progress.current += 1;
						console.verbose(`findOrPopulate task: ${inspect(task)}`);
						return mp;
					}) );
			})(disk);
			task.progress.current += 1;
			console.verbose(`findOrPopulate task: ${inspect(task)}`);
		});
		await null;
	} catch (e) {
		console.error(`disk.findOrPopulate: error: ${e.stack||e}`);
		model._stats.findOrPopulate.errors.push(err);
		// throw e;
	}

	console.log(`getDevices: pr=${inspect(pr)}`);
});
		
	// these collections should be relatively small, and will be referred to by all fsEntry objects, so cache locally
	// .then(() => Q.all([
	// 	model.find({}).then(_disks => disks = _disks),
	// 	Partition.find({}).then(_partitions => partitions = _partitions)
	// ]))

	// .then(() => { console.verbose(`${debugPrefix}: devices[${disks.length}] = ${inspect(disks)}\n` + `partitions[${partitions.length}] = ${inspect(partitions.length)}`); })

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
