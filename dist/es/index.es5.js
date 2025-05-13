/**
 * because babel can only export on default-attribute,
 * we use this for the non-module-build
 * this ensures that users do not have to use
 * var IdleQueue = require('custom-idle-queue').default;
 * but
 * var IdleQueue = require('custom-idle-queue');
 */

import { IdleQueue } from './index.js';
module.exports = {
  IdleQueue: IdleQueue
};