const async_hooks = require('async_hooks'),
	fs = require('fs'),
	http = require('http');

const hook = async_hooks.createHook({
	init(asyncId, type, triggerAsyncId, resource) {
		fs.writeSync(1, `[init] (${asyncId}:${triggerAsyncId}) ${type} - ${resource}\n`);
	},
	before(asyncId) {
		fs.writeSync(1, `[before] (${asyncId})\n`);
	},
	after(asyncId) {
		fs.writeSync(1, `[after] (${asyncId})\n`);
	},
	destroy(asyncId) {
		fs.writeSync(1, `[destroy] (${asyncId})\n`);
	}
}).enable();

class MyInterval extends async_hooks.AsyncResource {
	constructor() {
		super('MyInterval');
		this.count = 0;
	}

	timeThing(callback) {
		this.timer = setInterval(() => {
			this.emitBefore();
			callback(null, ++this.count);
			this.emitAfter();
		}, 500);
	}

	close() {
		clearInterval(this.timer);
		this.count = 0;
		this.emitDestroy();
	};
}

const int = new MyInterval();
int.timeThing((err, count) => {
	if (count < 3) {
		fs.writeSync(1, `count: ${count}\n`);
	} else {
		int.close();
	}
});