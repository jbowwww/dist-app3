
"use strict";
const console = require('../stdio.js').Get('test/new_Queue', { minLevel: 'log' });	// debug verbose log
const inspect = require('../utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const Queue = require('../Queue.js');

const q = new Queue({ concurrency: 4 });

const t = val => new Promise(resolve => setTimeout(() => resolve(val), 100));

(async () => {
	console.log(`Start: `);
	for (let i = 0; i < 100; i++) {
		let e = q.enqueue(t, i);
		console.log(`enqueue task(${i}): q=${q._debug()}`);
		let r = await e;
		console.log(`task(${i}) enqueue result=${inspect(r)}: q=${q._debug()}`);
	}

	await q.onIdle();
	console.log(`Q1: ${q._debug()}`);

	for (let i = 0; i < 100; i++) {
		let e = q.enqueue(t, i);
		console.log(`enqueueAndRun task(${i}): q=${q._debug()}`);
		let r = await e;
		console.log(`task(${i}) enqueueAndRun result=${inspect(r)}: q=${q._debug()}`);
	}

	console.log(`Q2: ${q._debug()}`);
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