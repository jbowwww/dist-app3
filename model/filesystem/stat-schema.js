"use strict";

const mongoose = require('mongoose');

module.exports = new mongoose.Schema({
	"dev" : Number,
	"mode" : Number,
	"nlink" : Number,
	"uid" : Number,
	"gid" : Number,
	"rdev" : Number,
	"blksize" : { type: Number, required: true, default: null },
	"ino" : Number,
	"size" : Number,
	"blocks" : { type: Number, required: true, default: null },
	"atime" : Date,
	"mtime" : Date,
	"ctime" : Date,
	"birthtime" : Date,
	"atimeMs" : Number,
	"mtimeMs" : Number,
	"ctimeMs" : Number,
	"birthtimeMs" : Number
}, {
	_id: false
});
