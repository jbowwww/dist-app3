"use strict";
const inspect = require('./utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('./utility.js').makeInspect({ depth: 8, compact: false });
const { promisifyMethods } = require('./utility.js');
const util = require('util');
const _ = require('lodash');
const nodePath = require('path');
const Q = require('q');
const mongoose = require('mongoose');
// const Q = mongoose.Promise;

// const FileSys = require('./model/filesys');
// const { Disk, FsEntry, File, Dir } = FileSys;

var paths = [
	'/home/jk/.config',
	'/home/jk/Desktop/New\ File',
	'/home/jk',
	'/'
];

_.forEach(paths, path => {
	console.log(`path='${path}' dirname='${nodePath.dirname(path)}'`);
});
