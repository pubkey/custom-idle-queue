/**
 * this queue tracks the currently running database-interactions
 * so we know when the database is in idle-state and can call
 * requestIdlePromise for semi-important actions
 */

const util = require('./util');
const PROMISE_RESOLVE_MAP = new WeakMap();
const PROMISE_TIMEOUT_MAP = new Map();

/**
 * Creates a new Idle-Queue
 * @constructor
 * @param {number} [parallels=1] amount of parrallel runs of the limited-ressource
 */
const IdleQueue = function(parallels = 1) {
    this._parallels = parallels || 1;

    /**
     * each lock() increased this number
     * each unlock() decreases this number
     * If _queueCounter==0, the state is in idle
     * @type {Number}
     */
    this._queueCounter = 0;

    /**
     * contains all functions that where added via requestIdlePromise()
     * and not have been run
     * @type {Array<function>} _idleCalls with oldest promise last
     */
    this._idleCalls = [];

    this._lastHandleNumber = 0;

    /**
     * Contains the handleNumber on the left
     * And the assigned promise on the right.
     * This is stored so you can use cancelIdleCallback(handleNumber)
     * to stop executing the callback.
     * @type {Map<Number><Promise>}
     */
    this._handlePromiseMap = new Map();
    this._promiseHandleMap = new Map();
};

// STATICS

IdleQueue.prototype = {

    _newHandleNumber() {
        this._lastHandleNumber++;
        return this._lastHandleNumber;
    },

    /**
     * creates a lock in the queue
     * and creates an unlock-function to remove the lock from the queue
     * @return {function} unlock function than must be called afterwards
     */
    lock() {
        console.log('lock()');
        this._queueCounter++;
        const unlock = (() => this._unLock()).bind(this);
        return unlock;
    },

    _unLock() {
        console.log('unlock() ' + this._queueCounter);
        this._queueCounter--;
        this._tryIdleCall();
    },

    /**
     * wraps a function with lock/unlock and runs it
     * @param  {function}  fun
     * @return {Promise<any>}
     */
    wrapCall(fun) {
        const unlock = this.lock();

        let maybePromise;
        try {
            maybePromise = fun();
        } catch (err) {
            unlock();
            throw err;
        }

        return Promise.resolve(maybePromise)
            .then(ret => {
                // sucessfull -> unlock before return
                unlock();
                return ret;
            })
            .catch(err => {
                // not sucessfull -> unlock before throwing
                unlock();
                throw err;
            });
    },

    /**
     * does the same as requestIdleCallback() but uses promises instead of the callback
     * @param {{timeout?: number}} options like timeout
     * @return {Promise<void>} promise that resolves when the database is in idle-mode
     */
    requestIdlePromise(options) {
        options = options || {};
        let resolve;

        const prom = new Promise(res => resolve = res);
        const resolveFromOutside = () => {
            console.log('resolveFromOutside()');
            this._removeIdlePromise(prom);
            resolve();
        };
        PROMISE_RESOLVE_MAP.set(prom, resolveFromOutside);

        if (options.timeout) { // if timeout has passed, resolve promise even if not idle
            const timeoutObj = setTimeout(() => {
                PROMISE_RESOLVE_MAP.get(prom)();
            }, options.timeout);
            PROMISE_TIMEOUT_MAP.set(prom, timeoutObj);
        }

        this._idleCalls.unshift(prom);

        this._tryIdleCall();
        return prom;
    },
    /**
     * remove the promise so it will never be resolved
     * @param  {Promise} promise from requestIdlePromise()
     * @return {void}
     */
    cancelIdlePromise(promise) {
        this._removeIdlePromise(promise);
        this._removeIdlePromise(promise);
    },

    /**
     * removes the promis from the queue and maps and also its corresponding handle-number
     * @param  {Promise} promise from requestIdlePromise()
     * @return {void}
     */
    _removeIdlePromise(promise) {
        // remove timeout if exists
        const timeoutObj = PROMISE_TIMEOUT_MAP.get(promise);
        if (timeoutObj) {
            clearTimeout(timeoutObj);
            PROMISE_TIMEOUT_MAP.delete(promise);
        }

        // remove handle-nr if exists
        const handle = this._promiseHandleMap.get(promise);
        this._handlePromiseMap.delete(handle);
        this._promiseHandleMap.delete(promise);

        // remove from queue
        const index = this._idleCalls.indexOf(promise);
        this._idleCalls.splice(index, 1);

    },

    /**
     * api equal to
     * @link https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
     * @param  {Function} callback
     * @param  {options}   options  [description]
     * @return {number} handle which can be used with cancelIdleCallback()
     */
    requestIdleCallback(callback, options) {
        const handle = this._newHandleNumber();
        const promise = this.requestIdlePromise(options);

        this._handlePromiseMap.set(handle, promise);
        this._promiseHandleMap.set(promise, handle);

        promise.then(() => callback());

        return handle;
    },

    /**
     * API equal to
     * @link https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelIdleCallback
     * @param  {number} handle returned from requestIdleCallback()
     * @return {void}
     */
    cancelIdleCallback(handle) {
        const promise = this._handlePromiseMap.get(handle);
        this.cancelIdlePromise(promise);
    },

    /**
     * resolves the last entry of this._idleCalls
     * but only if the queue is empty
     * @return {Promise}
     */
    _tryIdleCall() {
        // ensure this does not run in parallel
        if (this._tryIdleCallRunning || this._idleCalls.length === 0)
            return;
        this._tryIdleCallRunning = true;

        // w8 one tick
        return util.nextTick()
            .then(() => {

                // check if queue empty
                if (this._queueCounter !== 0) {
                    this._tryIdleCallRunning = false;
                    return;
                };

                /**
                 * wait 1 tick here
                 * because many functions do IO->CPU->IO
                 * which means the queue is empty for a short time
                 * but the db is not idle
                 */
                return util.nextTick()
                    .then(() => {
                        // check if queue still empty
                        if (this._queueCounter !== 0) {
                            this._tryIdleCallRunning = false;
                            return;
                        }

                        // db is idle
                        this._resolveOneIdleCall();
                        this._tryIdleCallRunning = false;
                    });
            });
    },

    /**
     * processes the oldest call of the idleCalls-queue
     * @return {Promise<void>}
     */
    _resolveOneIdleCall() {
        if (this._idleCalls.length === 0) return;

        const oldestPromise = this._idleCalls[this._idleCalls.length - 1];
        const resolveFun = PROMISE_RESOLVE_MAP.get(oldestPromise);
        resolveFun();

        // try to call the next tick
        return util.nextTick()
            .then(() => this._tryIdleCall());
    },

    /**
     * clears and resets everything
     * @return {void}
     */
    clear() {
        this._queueCounter = 0;
        this._idleCalls = [];
        this._handlePromiseMap = new Map();
        this._promiseHandleMap = new Map();
    }
};

module.exports = IdleQueue;
