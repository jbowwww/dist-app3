
"use strict";
const console = require('./stdio.js').Get('Task', { minLevel: 'debug' }); // debug verbose log
const util = require('util');
const inspect = require('./utility.js').makeInspect({ depth: 3, getters: true, colors: true, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const fs = require('fs');
const asyncHooks = require('async_hooks');

// can these be created directly in the class?
const _contexts = {};
const _uniqueContexts = [];
const _created = [];
const _running = [];
const _finished = [];

class Task extends asyncHooks.AsyncResource {

  static get contexts() { return _contexts; }
  static get uniqueContexts() { return _uniqueContexts; }

  static get all() { return _.concat(this.finished, this.running); }
  static get created() { return _created; }
  static get running() { return _running; }
  static get finished() { return _finished; }

  // new Task([options, ]fn)
  constructor(options, fn) {
    if (arguments.length === 1) {
      fn = options;
      options = {};
    }
    if (!_.isFunction(fn)) {
      throw new TypeError(`fn should be a function but is a ${typeof fn}`);
    }
    super('Task');
    this.fn = fn;
    this.options = options;
    this.asyncId = asyncHooks.executionAsyncId();
    this.triggerAsyncId = asyncHooks.triggerAsyncId();
    if (_.includes(_.keys(_contexts), this.triggerAsyncId)) {
      this.context =  _contexts[this.triggerAsyncId];
      fs.writeSync(1, `new Task(${options}, ${fn.name||'(anon)'}): asyncId=${this.asyncId} triggerAsyncId=${this.triggerAsyncId} with parent context=${inspect(this.context)}`);
    } else {
      this.context = {};
      this.context.rootTask = this;
      _contexts[this.asyncId] = this.context;
      uniqueContexts.push(this.context);
      fs.writeSync(1, `new Task(${options}, ${fn.name||'(anon)'}): asyncId=${this.asyncId} triggerAsyncId=${this.triggerAsyncId} with NEW context=${inspect(this.context)}`);
    }
    Task.created.push(this);
  }

  get name() {
    return this.fn ? this.fn.name ? this.fn.name : '(anon)' : '(noop)';
  }

  run(...args) {
    console.verbose(`Running task '${this.name}' with args=${inspect(args)}`);
    _.pull(Task.created, this);
    this._promise = this.fn(...args)
    .finally(() => {
            _.pull(Task.running, this);
            Task.finished.push(this);
    });
    _.pull(Task.created, this);
    Task.running.push(this);
    return this._promise;
  }

  async* queryProgress(query) {
    console.verbose(`queryProgress: query=${inspect(query.getQuery())}`);
    let count = await query.countDocuments();
    this.progress.max = count;
    this.progress.current = 0;
    for await (let r of query.cursor()) {
      this.markActive();
      yield await r;
      this.progress.current++;
    }
  }

  async* trackProgress(generator) {
    for await (let r of generator) {
    _.assign(this.progress, generator.task);
    yield await r;
  }
};

}

const asyncHook = asyncHooks.createHook({ init, before, after, destroy, promiseResolve }).enable(); // asyncHook.disable();

function init(asyncId, type, triggerAsyncId, resource) {  // resource may not have completed construction when this callback runs, therefore don't expect all fields populated (although doesn't appear to be the actual Task instance either?)
  if (Task.contexts[triggerAsyncId]) {
    Task.contexts[asyncId] = Task.contexts[triggerAsyncId];
    fs.writeSync(1, `init: asyncId=${asyncId} triggerAsyncId=${triggerAsyncId}\n`)
  } else {
    fs.writeSync(1, `init: asyncId=${asyncId} triggerAsyncId=${triggerAsyncId} NO CONTEXT FOUND\n`)
  }
}
function before(asyncId) { }
function after(asyncId) { }
function destroy(asyncId) { }
function promiseResolve(asyncId) { }  // promiseResolve is called only for promise resources,

module.exports = Task;
