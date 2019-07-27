
"use strict";
const console = require('./stdio.js').Get('test/new_fs_iterable', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const { FsIterable } = require('./fs/FsIterable.js');

const fsIterable = new FsIterable('/home/jk');


(async () => {
console.log(`Start: ${inspect(fsIterable)}`);
	for await (let fsItem of fsIterable) {
		console.log(`fsItem: Progress = ${(100 * fsIterable.itemIndex / fsIterable.count.all).toFixed(1)}%`);//${inspect(fsItem)}`);
		await new Promise((resolve) => setTimeout(resolve,100));
	}
console.log(`Done: ${inspect(fsIterable)}`);
})();

process.once('SIGINT', onSigInt);
function onSigInt() {
console.log(`fsIterable: ${inspect(fsIterable)}`);
	process.once('SIGINT', quitHandler);
	setTimeout(() => {
			process.off('SIGINT', quitHandler);
			process.once('SIGINT', onSigInt);
		}, 1000);
	function quitHandler() {
		process.nextTick(() => process.exit(0));
	}
};