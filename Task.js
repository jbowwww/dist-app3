
"use strict";
const console = require('./stdio.js').Get('Task', { minLevel: 'debug' }); // debug verbose log
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

      this.context.stack.push(this);
    // this.asyncId = asyncHooks.executionAsyncId();
    // const triggerAsyncId = asyncHooks.triggerAsyncId();
    // if (!!Task.contexts[this.triggerAsyncId]) {
    //   this.context =  Task.contexts[this.triggerAsyncId];
    //   this.context.stack.push(this);
    //   // TODO: Convert stdio.js to use fs.writeSync (optionally or permanently?) so can use it here and get standard formatted logging
    //   fs.writeSync(1, `new Task(${options}, ${fn.name||'(anon)'}): asyncId=${this.asyncId} triggerAsyncId=${this.triggerAsyncId} with parent context=${inspect(this.context)}`);
    // } else {
    //   this.context = {
    //     get rootTask() { return this.context.stack && this.context.stack.length ? this.context.stack[0] : null; },
    //     stack: [ /*this*/ ],
    //     get stackNames() { return this.context.stack.map(task => task.name); }
    //   };
    //   Task.uniqueContexts.push(this.context);
    //   fs.writeSync(1, `new Task(${options}, ${fn.name||'(anon)'}): asyncId=${this.asyncId} triggerAsyncId=${this.triggerAsyncId} with NEW context=${inspect(this.context)}`);
    // }
    // Task.contexts[this.asyncId] = this.context;
    Task.created.push(this);
    fs.writeSync(1, `new Task(${this.options}, func '${this.name}'): asyncId=${this.asyncId} triggerAsyncId=${this.triggerAsyncId} with context=${inspect(this.context)}`);
  }

  get name() {
    return this.fn ? this.fn.name ? this.fn.name : '(anon)' : '(noop)';
  }

  run(...args) {
    console.verbose(`Running task '${this.name}' with args=${inspect(args)}`);
    _.pull(Task.created, this);
    this._promise = this.runInAsyncScope(this.fn, this, ...args)
    .finally(() => {
      _.pull(Task.running, this);
      Task.finished.push(this);
      if (_.last(this.context.stack) !== this) {
        throw new Error(`last(this.context) !== this , asyncId=${this.asyncId} , fn=${this.name}`);
      }
      this.context.stack.slice(0, -1);
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
  // necessary to keep track of context across async resources, as tasks will rarely directly trigger another task (or so it seems) 
  // fs.writeSync(1, `init#1: type=${type} asyncId=${asyncId} triggerAsyncId=${triggerAsyncId} task=${resource} task props=${Object.getOwnPropertyNames(resource)} task syms=${Object.getOwnPropertySymbols(resource).map(s=>String(s))}\n`);
  resource.asyncId = asyncId;
  resource.triggerAsyncId = triggerAsyncId;
  if (!!Task.contexts[triggerAsyncId]) {
    Task.contexts[asyncId] = Task.contexts[triggerAsyncId];
    if (type === 'Task') {
      const task = resource;
      task.context = Task.contexts[asyncId];
      // fs.writeSync(1, `new Task(${task.options}, ${task.fn.name||'(anon)'}): asyncId=${task.asyncId} triggerAsyncId=${task.triggerAsyncId} with parent context=${inspect(task.context)}`);
      fs.writeSync(1, `init (context found): type=${type} asyncId=${asyncId} triggerAsyncId=${triggerAsyncId} task=${resource} task props=${Object.getOwnPropertyNames(resource)} task syms=${Object.getOwnPropertySymbols(resource).map(s=>String(s))}\n`);
    }
    // fs.writeSync(1, `init: asyncId=${asyncId} triggerAsyncId=${triggerAsyncId} task.fn=${Task.contexts[asyncId].rootTask.fn.name}\n`)
  } else {
    if (type === 'Task') {
      const task = resource;
      task.context = {
        get rootTask() { return task.context.stack && task.context.stack.length ? task.context.stack[0] : null; },
        stack: [ /*this*/ ],
        get stackNames() { return task.context.stack.map(t => t.name); }
      };
      Task.contexts[asyncId] = task.context;
      Task.uniqueContexts.push(task.context);
      fs.writeSync(1, `init (NEW context): type=${type} asyncId=${asyncId} triggerAsyncId=${triggerAsyncId} task=${resource} task props=${Object.getOwnPropertyNames(resource)} task syms=${Object.getOwnPropertySymbols(resource).map(s=>String(s))}\n`);
      // fs.writeSync(1, `new Task(${task.options}, ${task.fn.name||'(anon)'}): asyncId=${task.asyncId} triggerAsyncId=${task.triggerAsyncId} with NEW context=${inspect(task.context)}`);
    }
    // fs.writeSync(1, `init: asyncId=${asyncId} triggerAsyncId=${triggerAsyncId} NO CONTEXT FOUND\n`)
  }
}
function before(asyncId) { }
function after(asyncId) { }
function destroy(asyncId) { }
function promiseResolve(asyncId) { }  // promiseResolve is called only for promise resources,

module.exports = Task;
