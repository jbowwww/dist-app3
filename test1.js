"use strict";
const inspect = require('./utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('./utility.js').makeInspect({ depth: 8, compact: false });
const { promisifyMethods } = require('./utility.js');
const util = require('util');
const _ = require('lodash');
const Q = require('q');
const mongoose = require('mongoose');
// const Q = mongoose.Promise;

const FileSys = require('./model/filesys');
// const { Disk, FsEntry, File, Dir } = FileSys;

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true })

.then(() => mongoose.model('file').find().populate('dir partition').exec((err, docs) => {
	if (err) {
		return console.error(`err: ${err.stack||err}`);
	}
	console.log(`docs: ${inspectPretty(docs)}`);
}))

.catch(err => console.error(`err2: ${err.stack||err}`));
