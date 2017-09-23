/**
 * returns a promise that resolves on the next tick
 * @return {Promise}
 */
export function nextTick() {
    return new Promise(res => setTimeout(res, 0));
}
