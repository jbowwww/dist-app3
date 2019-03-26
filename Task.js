
"use strict";
const console = require('./stdio.js').Get('Task', { minLevel: 'debug' }); // debug verbose log
const util = require('util');
const inspect = require('./utility.js').makeInspect({ depth: 3, getters: true, /*colors: true,*/ /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const fs = require('fs');
const asyncHooks = require('async_hooks');

const _contexts = [ ];
const _uniqueContexts = [ ];
const _created = [];
const _running = [];
const _finished = [];

class Task extends asyncHooks.AsyncResource {

  static get contexts() { return _contexts; }
  static get uniqueContexts() { return _uniqueContexts; }
  static get current() { return _contexts[asyncHooks.executionAsyncId()]; }

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
    console.verbose(`new Task(${this.options}, func '${this.name}'): asyncId=${this.asyncId} triggerAsyncId=${this.triggerAsyncId} with context.stack=${inspect(this.context ? this.context.stack : {})}`);
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

// const _rootContext = new Task(function rootContext() {});
// Task.contexts.push(_rootContext);
// Task.uniqueContexts.push(_rootContext);


const asyncHook = asyncHooks.createHook({ init, before, after, destroy, promiseResolve }).enable(); // asyncHook.disable();

function init(asyncId, type, triggerAsyncId, resource) {  // resource may not have completed construction when this callback runs, therefore don't expect all fields populated (although doesn't appear to be the actual Task instance either?)
  resource.asyncId = asyncId;
  resource.triggerAsyncId = triggerAsyncId;
  if (!!Task.contexts[triggerAsyncId]) {
    Task.contexts[asyncId] = Task.contexts[triggerAsyncId];
    if (type === 'Task') {
      const task = resource;
      task.context = Task.contexts[asyncId]/* || { stack: [] }*/;
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
  // fs.writeSync(1, `async_hook:init: asyncId=${asyncId} type='${type}' triggerAsyncId=${triggerAsyncId} resource=${inspect(resource)}`);
}
function before(asyncId) { }
function after(asyncId) { }
function destroy(asyncId) {
  // fs.writeSync(1, `async_hook:destroy: asyncId=${asyncId}`);
}
function promiseResolve(asyncId) { }  // promiseResolve is called only for promise resources,

Task.trace = function trace(target) {
  if (typeof target === 'function') {
    if (target.constructor.name === 'AsyncFunction') {
      return traceWrapAsync;
    } else if (target.constructor.name === 'AsyncGeneratorFunction') {
      return traceWrapAsyncGenerator;
    } else {
      return traceWrap;
    }
  } else if (_.isPlainObject(target)) {
    for (let key in target) {
      let value = target[key];
      console.verbose(`trace: object: key=${key} typeof value=${typeof value} value.constructor=${value.constructor}`);
      Object.defineProperty(target, key, {
        enumerable: true,
        writeable: false,
        configurable: true,
        value: trace(value)
      });
    }
    return target;
  } else {
    throw new Error(`Task: trace: typeof target == ${typeof target}`);
  }
  function traceWrap(...args) {
    console.log(`trace: start ${target.name || '(anon)'}: args=${inspect(args)}}`);
    let r = target.apply(this, args);
    console.log(`trace: finish ${target.name || '(anon)'}: args=${inspect(args)}} r=${inspect(r)}`);
    return r;
  }
  function traceWrapAsync(...args) {
    console.log(`trace: start async ${target.name || '(anon)'}: args=${inspect(args)}}`);
    return target.apply(this, args).then(r => {
      console.log(`trace: finish async ${target.name || '(anon)'}: args=${inspect(args)}} r=${inspect(r)}`);
      return r;
    });
  }
  async function* traceWrapAsyncGenerator(...args) {
    console.log(`trace: start async ${target.name || '(anon)'}: args=${inspect(args)}}`);
    for await (let i of target.apply(this, args)) {//.then(r => {
      yield i;
    }
    console.log(`trace: finish async ${target.name || '(anon)'}: args=${inspect(args)}} r=${inspect(r)}`);
      // return;
    // });
  }
};

module.exports = Task;

