"use strict";

module.exports = function () {
    var exports = {};

    /**
     * returns a promise that resolves on the next tick
     * @return {Promise}
     */
    exports.nextTick = function () {
        return new Promise(function (res) {
            return setTimeout(res, 0);
        });
    };

    return exports;
}();