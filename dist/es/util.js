import _Promise from "babel-runtime/core-js/promise";
/**
 * returns a promise that resolves on the next tick
 * @return {Promise}
 */
export function nextTick() {
  return new _Promise(function (res) {
    return setTimeout(res, 0);
  });
}