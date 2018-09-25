
const mongoose = require('mongoose');

var fsEntrySchema = new mongoose.Schema({
	path: { type: String, unique: true, index: true, required: true },
	stats : { type: require('./stat-schema.js'), required: true }
}, {
	discriminatorKey: 'fileType'
});

fsEntrySchema.plugin(require('../timestamp-plugin.js'));

module.exports = fsEntrySchema;