"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require("babel-runtime/core-js/promise");

var _promise2 = _interopRequireDefault(_promise);

exports.nextTick = nextTick;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

/**
 * returns a promise that resolves on the next tick
 * @return {Promise}
 */
function nextTick() {
  return new _promise2["default"](function (res) {
    return setTimeout(res, 0);
  });
}