
"use strict";
const console = require('./stdio.js').Get('Task', { minLevel: 'log' }); // debug verbose log
const util = require('util');
const inspect = require('./utility.js').makeInspect({ depth: 3, getters: true, /*colors: true,*/ /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const fs = require('fs');
const asyncHooks = require('async_hooks');

const _contexts = [];
const _uniqueContexts = [];
const _created = [];
const _running = [];
const _finished = [];

class Task extends asyncHooks.AsyncResource {

  static get contexts() { return _contexts; }
  static get uniqueContexts() { return _uniqueContexts; }

  static get all() { return _.concat(Task.created, Task.running, Task.finished); }
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
    Task.created.push(this);
    console.verbose(1, `new Task(${this.options}, func '${this.name}'): asyncId=${this.asyncId} triggerAsyncId=${this.triggerAsyncId} with context.stack=${inspect(this.context.stack)}`);
  }

  get name() {
    return this.fn ? this.fn.name ? this.fn.name : '(anon)' : '(noop)';
  }

  run(...args) {
    console.verbose(`Running task '${this.name}' with args=${inspect(args)}`);
    _.pull(Task.created, this);
    this._promise = this.runInAsyncScope(this.fn, this, ...args)
    .catch(err => { console.error(`Task.run '${this.name}' error: ${err.stack||err}`); throw err; })
    .finally(() => {
      _.pull(Task.running, this);
      Task.finished.push(this);
      const last = _.last(this.context.stack);
      console.verbose(`after Task '${this.name} asyncId=${this.asyncId} triggerAsyncId=${this.triggerAsyncId}: context.stack=${inspect(this.context.stack)}`);//{name:${last.name}, asyncId:${last.asyncId}, triggerAsyncId:${last.triggerAsyncId}`);
      if (last.asyncId !== this.asyncId) {
        throw new Error(`last(this.context) !== this , this={asyncId:${this.asyncId}, triggerAsyncId:${this.triggerAsyncId}, fn:${this.name}}, last={asyncId:${last.asyncId}, triggerAsyncId:${last.triggerAsyncId}, fn:${last.name}}`);
      }
      _.pull(this.context.stack, this);
      console.verbose(`this.context.stack=${inspect(this.context.stack)}`);
      this.emitDestroy();
    });
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
  resource.asyncId = asyncId;
  resource.triggerAsyncId = triggerAsyncId;
  if (!!Task.contexts[triggerAsyncId]) {
    Task.contexts[asyncId] = Task.contexts[triggerAsyncId];
    if (type === 'Task') {
      const task = resource;
      task.context = Task.contexts[asyncId];
            task.context.stack.push(task);
    }
  } else {
    if (type === 'Task') {
      const task = resource;
      task.context = {
        get rootTask() { return task.context.stack && task.context.stack.length ? task.context.stack[0] : null; },
        stack: [task ],
        get stackNames() { return task.context.stack.map(t => t.name); }
      };
      Task.contexts[asyncId] = task.context;
      Task.uniqueContexts.push(task.context);
    }
  }
}
function before(asyncId) { }
function after(asyncId) { }
function destroy(asyncId) { }
function promiseResolve(asyncId) { }  // promiseResolve is called only for promise resources,

module.exports = Task;
