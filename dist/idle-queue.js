'use strict';

/**
 * this queue tracks the currently running database-interactions
 * so we know when the database is in idle-state and can call
 * requestIdlePromise for semi-important actions
 */

var util = require('./util');
var PROMISE_RESOLVE_MAP = new Map();
var PROMISE_TIMEOUT_MAP = new Map();

/**
 * Creates a new Idle-Queue
 * @constructor
 * @param {number} [parallels=1] amount of parrallel runs of the limited-ressource
 */
var IdleQueue = function IdleQueue() {
    var parallels = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;

    this._parallels = parallels || 1;

    /**
     * each lock() increased this number
     * each unlock() decreases this number
     * If _queueCounter==0, the state is in idle
     * @type {Number}
     */
    this._queueCounter = 0;

    /**
     * contains all promises that where added via requestIdlePromise()
     * and not have been resolved
     * @type {Array<Promise>} _idleCalls with oldest promise last
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
    _newHandleNumber: function _newHandleNumber() {
        this._lastHandleNumber++;
        return this._lastHandleNumber;
    },


    /**
     * creates a lock in the queue
     * and returns an unlock-function to remove the lock from the queue
     * @return {function} unlock function than must be called afterwards
     */
    lock: function lock() {
        var _this = this;

        this._queueCounter++;
        var unlock = function () {
            return _this._unLock();
        }.bind(this);
        return unlock;
    },
    _unLock: function _unLock() {
        this._queueCounter--;
        this._tryIdleCall();
    },


    /**
     * wraps a function with lock/unlock and runs it
     * @param  {function}  fun
     * @return {Promise<any>}
     */
    wrapCall: function wrapCall(fun) {
        var unlock = this.lock();

        var maybePromise = void 0;
        try {
            maybePromise = fun();
        } catch (err) {
            unlock();
            throw err;
        }

        return Promise.resolve(maybePromise).then(function (ret) {
            // sucessfull -> unlock before return
            unlock();
            return ret;
        })['catch'](function (err) {
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
    requestIdlePromise: function requestIdlePromise(options) {
        var _this2 = this;

        options = options || {};
        var resolve = void 0;

        var prom = new Promise(function (res) {
            return resolve = res;
        });
        var resolveFromOutside = function resolveFromOutside() {
            _this2._removeIdlePromise(prom);
            resolve();
        };
        PROMISE_RESOLVE_MAP.set(prom, resolveFromOutside);

        if (options.timeout) {
            // if timeout has passed, resolve promise even if not idle
            var timeoutObj = setTimeout(function () {
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
    cancelIdlePromise: function cancelIdlePromise(promise) {
        this._removeIdlePromise(promise);
        this._removeIdlePromise(promise);
    },


    /**
     * removes the promis from the queue and maps and also its corresponding handle-number
     * @param  {Promise} promise from requestIdlePromise()
     * @return {void}
     */
    _removeIdlePromise: function _removeIdlePromise(promise) {
        // remove resolve-function
        PROMISE_RESOLVE_MAP['delete'](promise);

        // remove timeout if exists
        var timeoutObj = PROMISE_TIMEOUT_MAP.get(promise);
        if (timeoutObj) {
            clearTimeout(timeoutObj);
            PROMISE_TIMEOUT_MAP['delete'](promise);
        }

        // remove handle-nr if exists
        var handle = this._promiseHandleMap.get(promise);
        this._handlePromiseMap['delete'](handle);
        this._promiseHandleMap['delete'](promise);

        // remove from queue
        var index = this._idleCalls.indexOf(promise);
        this._idleCalls.splice(index, 1);
    },


    /**
     * api equal to
     * @link https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
     * @param  {Function} callback
     * @param  {options}   options  [description]
     * @return {number} handle which can be used with cancelIdleCallback()
     */
    requestIdleCallback: function requestIdleCallback(callback, options) {
        var handle = this._newHandleNumber();
        var promise = this.requestIdlePromise(options);

        this._handlePromiseMap.set(handle, promise);
        this._promiseHandleMap.set(promise, handle);

        promise.then(function () {
            return callback();
        });

        return handle;
    },


    /**
     * API equal to
     * @link https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelIdleCallback
     * @param  {number} handle returned from requestIdleCallback()
     * @return {void}
     */
    cancelIdleCallback: function cancelIdleCallback(handle) {
        var promise = this._handlePromiseMap.get(handle);
        this.cancelIdlePromise(promise);
    },


    /**
     * resolves the last entry of this._idleCalls
     * but only if the queue is empty
     * @return {Promise}
     */
    _tryIdleCall: function _tryIdleCall() {
        var _this3 = this;

        // ensure this does not run in parallel
        if (this._tryIdleCallRunning || this._idleCalls.length === 0) return;
        this._tryIdleCallRunning = true;

        // w8 one tick
        return util.nextTick().then(function () {

            // check if queue empty
            if (_this3._queueCounter >= _this3._parallels) {
                _this3._tryIdleCallRunning = false;
                return;
            };

            /**
             * wait 1 tick here
             * because many functions do IO->CPU->IO
             * which means the queue is empty for a short time
             * but the db is not idle
             */
            return util.nextTick().then(function () {
                // check if queue still empty
                if (_this3._queueCounter >= _this3._parallels) {
                    _this3._tryIdleCallRunning = false;
                    return;
                }

                // db is idle
                _this3._resolveOneIdleCall();
                _this3._tryIdleCallRunning = false;
            });
        });
    },


    /**
     * processes the oldest call of the idleCalls-queue
     * @return {Promise<void>}
     */
    _resolveOneIdleCall: function _resolveOneIdleCall() {
        var _this4 = this;

        if (this._idleCalls.length === 0) return;

        var oldestPromise = this._idleCalls[this._idleCalls.length - 1];
        var resolveFun = PROMISE_RESOLVE_MAP.get(oldestPromise);
        resolveFun();

        // try to call the next tick
        return util.nextTick().then(function () {
            return _this4._tryIdleCall();
        });
    },


    /**
     * clears and resets everything
     * @return {void}
     */
    clear: function clear() {
        var _this5 = this;

        // remove all non-cleared
        this._idleCalls.forEach(function (promise) {
            return _this5._removeIdlePromise(promise);
        });

        this._queueCounter = 0;
        this._idleCalls = [];
        this._handlePromiseMap = new Map();
        this._promiseHandleMap = new Map();
    }
};

module.exports = IdleQueue;