/**
 * Creates a new Idle-Queue
 * @constructor
 * @param {number} [parallels=1] amount of parrallel runs of the limited-ressource
 */
export const IdleQueue = function (parallels = 1) {
    this._parallels = parallels || 1;

    /**
     * _queueCounter
     * each lock() increased this number
     * each unlock() decreases this number
     * If _qC==0, the state is in idle
     * @type {Number}
     */
    this._qC = 0;

    /**
     * _idleCalls
     * contains all promises that where added via requestIdlePromise()
     * and not have been resolved
     * @type {Set<Promise>} _iC with oldest promise first
     */
    this._iC = new Set();

    /**
     * _lastHandleNumber
     * @type {Number}
     */
    this._lHN = 0;

    /**
     * _handlePromiseMap
     * Contains the handleNumber on the left
     * And the assigned promise on the right.
     * This is stored so you can use cancelIdleCallback(handleNumber)
     * to stop executing the callback.
     * @type {Map<Number><Promise>}
     */
    this._hPM = new Map();
    this._pHM = new Map(); // _promiseHandleMap
};

IdleQueue.prototype = {

    isIdle() {
        return this._qC < this._parallels;
    },

    /**
     * creates a lock in the queue
     * and returns an unlock-function to remove the lock from the queue
     * @return {function} unlock function than must be called afterwards
     */
    lock() {
        this._qC++;
    },

    unlock() {
        this._qC--;
        _tryIdleCall(this);
    },

    /**
     * wraps a function with lock/unlock and runs it
     * @performance is really important here because
     * it is often used in hot paths.
     * @param  {function}  fun
     * @return {Promise<any>}
     */
    wrapCall(fun) {
        this._qC++;

        let maybePromise;
        try {
            maybePromise = fun();
        } catch (err) {
            this.unlock();
            throw err;
        }

        if (!maybePromise.then || typeof maybePromise.then !== 'function') {
            // no promise
            this.unlock();
            return maybePromise;
        } else {
            // promise
            return maybePromise
                .then(ret => {
                    // sucessfull -> unlock before return
                    this.unlock();
                    return ret;
                })
                .catch(err => {
                    // not sucessfull -> unlock before throwing
                    this.unlock();
                    throw err;
                });
        }
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
            _removeIdlePromise(this, prom);
            resolve();
        };

        prom._manRes = resolveFromOutside;

        if (options.timeout) { // if timeout has passed, resolve promise even if not idle
            const timeoutObj = setTimeout(() => {
                prom._manRes();
            }, options.timeout);
            prom._timeoutObj = timeoutObj;
        }

        this._iC.add(prom);

        _tryIdleCall(this);
        return prom;
    },
    /**
     * remove the promise so it will never be resolved
     * @param  {Promise} promise from requestIdlePromise()
     * @return {void}
     */
    cancelIdlePromise(promise) {
        _removeIdlePromise(this, promise);
    },

    /**
     * api equal to
     * @link https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
     * @param  {Function} callback
     * @param  {options}   options  [description]
     * @return {number} handle which can be used with cancelIdleCallback()
     */
    requestIdleCallback(callback, options) {
        const handle = this._lHN++;
        const promise = this.requestIdlePromise(options);

        this._hPM.set(handle, promise);
        this._pHM.set(promise, handle);

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
        const promise = this._hPM.get(handle);
        this.cancelIdlePromise(promise);
    },

    /**
     * clears and resets everything
     * @return {void}
     */
    clear() {

        // remove all non-cleared
        this._iC
            .forEach(promise => _removeIdlePromise(this, promise));

        this._qC = 0;
        this._iC.clear();
        this._hPM = new Map();
        this._pHM = new Map();
    }
};


/**
 * processes the oldest call of the idleCalls-queue
 * @return {Promise<void>}
 */
function _resolveOneIdleCall(idleQueue) {
    if (idleQueue._iC.size === 0) return;

    const iterator = idleQueue._iC.values();
    const oldestPromise = iterator.next().value;

    oldestPromise._manRes();

    // try to call the next tick
    setTimeout(() => _tryIdleCall(idleQueue), 0);
}


/**
 * removes the promise from the queue and maps and also its corresponding handle-number
 * @param  {Promise} promise from requestIdlePromise()
 * @return {void}
 */
function _removeIdlePromise(idleQueue, promise) {
    if (!promise) return;

    // remove timeout if exists
    if (promise._timeoutObj)
        clearTimeout(promise._timeoutObj);

    // remove handle-nr if exists
    if (idleQueue._pHM.has(promise)) {
        const handle = idleQueue._pHM.get(promise);
        idleQueue._hPM.delete(handle);
        idleQueue._pHM.delete(promise);
    }

    // remove from queue
    idleQueue._iC.delete(promise);
}

/**
 * resolves the last entry of this._iC
 * but only if the queue is empty
 * @return {Promise}
 */
function _tryIdleCall(idleQueue) {
    // console.log('_tryIdleCall:');
    // console.dir({
    //     try: idleQueue._tryIR,
    //     size: idleQueue._iC.size
    // });
    // ensure this does not run in parallel
    if (idleQueue._tryIR || idleQueue._iC.size === 0)
        return;
    idleQueue._tryIR = true;

    // w8 one tick
    setTimeout(() => {
        // check if queue empty
        if (!idleQueue.isIdle()) {
            idleQueue._tryIR = false;
            return;
        }

        /**
         * wait 1 tick here
         * because many functions do IO->CPU->IO
         * which means the queue is empty for a short time
         * but the ressource is not idle
         */
        setTimeout(() => {
            // check if queue still empty
            if (!idleQueue.isIdle()) {
                idleQueue._tryIR = false;
                return;
            }

            // ressource is idle
            _resolveOneIdleCall(idleQueue);
            idleQueue._tryIR = false;
        }, 0);
    }, 0);
}
