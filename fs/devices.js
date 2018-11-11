"use strict";

const console = require('../stdio.js').Get('fs/devices', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('../utility.js').makeInspect({ depth: 2, breakLength: 0 });
const util = require('util');
const _ = require('lodash');
const exec = util.promisify(require('child_process').exec)

module.exports = async function getDevices() {
	try {
		const { stdout, stderr } = await exec('./fs/lsblk -JO');
		var devices = JSON.parse(stdout);
		console.debug(`stdout: ${stdout}\nstderr: ${stderr}`);
		return devices;
	} catch (e) {
		console.error(`error: ${e.stack||e.message||e}`);
	}
};
