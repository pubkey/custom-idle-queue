"use strict";

var _index = require("./index.js");
/**
 * because babel can only export on default-attribute,
 * we use this for the non-module-build
 * this ensures that users do not have to use
 * var IdleQueue = require('custom-idle-queue').default;
 * but
 * var IdleQueue = require('custom-idle-queue');
 */

module.exports = {
  IdleQueue: _index.IdleQueue
};