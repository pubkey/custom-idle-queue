'use strict';

var _index = require('./index.js');

var _index2 = _interopRequireDefault(_index);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

module.exports = _index2['default']; /**
                                      * because babel can only export on default-attribute,
                                      * we use this for the non-module-build
                                      * this ensures that users do not have to use
                                      * var IdleQueue = require('custom-idle-queue').default;
                                      * but
                                      * var IdleQueue = require('custom-idle-queue');
                                      */