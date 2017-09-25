module.exports = (() => {
    const exports = {};

    /**
     * returns a promise that resolves on the next tick
     * @return {Promise}
     */
    exports.nextTick = () => {
        return new Promise(res => setTimeout(res, 0));
    };

    return exports;
})();
