const obj /*{ assignDefaults, inspect, promisify }*/ = require('@jbowwww/object-util');
const inspect = obj.inspect;
const log = require('debug')('worker');
const pEvent = (em, ev) => new Promise((resolve, reject) => em.once(ev, resolve).on('error', reject));/*require('p-event');*/
const assert = require('assert');
const {
  Worker, MessageChannel, MessagePort, isMainThread, parentPort
} = require('worker_threads');

// if (isMainThread) {

module.exports = {
  
  Worker(fn, options = {}) {
    // if (typeof fn !== 'function' || (!!options && typeof options !== 'object')) throw new TypeError();
    // options = Object.assign(, options);
    log(`options=${inspect(options)}`);
    return function (...args) {
      let _requires;
      if (obj.isArray(this.Worker.requires)) {
        _requires = {};
        for (const [k, v] of this.Worker.requires) {
          _requires[k] = v;
        }
      } else if (obj.isPlain(this.Worker.requires)) {
        _requires = this.Worker.requires;
      } else {
        _requires = {};
      }
      const worker = new Worker(
          // `${this.Worker.requires.map(([name, src]) => `const ${name} = require('${src}');`).join('\n')}`
          Object.entries(_requires).map(([name, src]) => `const ${name} = require('${src}');`).join('\n')
        + `\n(${fn.toString()})(${args.map(JSON.parse).join(',')})`, {
        eval: true,
        workerData: null,
        stdin: false,
        stdout: false,
        stderr: false
      });
      // const subChannel = new MessageChannel();
      // worker.postMessage({ hereIsYourPort: subChannel.port1 }, [subChannel.port1]);
      // subChannel.port2.on('message', (value) => {
      //   console.log('received:', value);
      log(`worker=${inspect(worker)}`);
      return worker;
    };
  },

  ContextWorker(contextFn) {
    log(`contextFn: ${contextFn} : ${contextFn.toString()}`);
    let ctxFn = contextFn.toString().trim();
    if (!ctxFn.startsWith('async ')) {
      ctxFn = 'async ' + ctxFn;
    }
    ctxFn = ctxFn.replace('(', contextFn.length === 0 ? '(fn' : '(fn, ');
    ctxFn = ctxFn.replace(')', ', ...args)');
    ctxFn = ctxFn.slice(0, ctxFn.length - 1);
    ctxFn += "require('worker_threads').parentPort.postMessage('exit', await fn(...args));\n}";
    log(`ctxFn: ${ctxFn}`);
    return function(fn, ...args) {
      log(`fn: ${fn}\nargs=${inspect(args)}`);
      return new Promise((resolve, reject) => {
        const worker = new Worker(
          `(${ctxFn})(${fn.toString}, ${args.map(JSON.parse).join(',')})`, {
          eval: true,
          workerData: null,
          stdin: false,
          stdout: false,
          stderr: false
        });
        worker.on('error', reject);
        worker.on('exit', resolve);
      });
    };
  }

};



// }
// } else {
//   parentPort.once('message', (value) => {
//     assert(value.hereIsYourPort instanceof MessagePort);
//     value.hereIsYourPort.postMessage('the worker is sending this');
//     value.hereIsYourPort.close();
//   });
// }
