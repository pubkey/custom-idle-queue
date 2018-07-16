/**
 * this runs some performance-test and measures the time
 */


const AsyncTestUtil = require('async-test-util');
const assert = require('assert');
const IdleQueue = require('../');

const benchmark = {
    wrapCalls: {},
    deepIdle: {},
    waitWrapped: {}
};

const elapsedTime = before => {
    return AsyncTestUtil.performanceNow() - before;
};

const getWaitPromise = (time = 1) => {
    return new Promise(res => {
        setTimeout(() => {
            res();
        }, time);
    });
};

describe('performance.test.js', () => {

    /**
     * add many wrapCalls and await many requestIdlePromises
     */
    it('wrapCalls', async () => {
        let count = 0;
        let count3 = 0;

        const startTime = AsyncTestUtil.performanceNow();
        const queue = new IdleQueue();

        for (let i = 0; i < 10000; i++) {
            queue.wrapCall(
                () => count3++
            );
        }

        const wrappedCall = () => queue.wrapCall(
            () => getWaitPromise().then(() => count++)
        );


        await queue.requestIdlePromise();
        for (let i = 0; i < 100000; i++)
            wrappedCall();

        console.log('# run wrapped calls');
        await queue.requestIdlePromise();
        assert.equal(count, 100000);

        await queue.requestIdlePromise();

        console.log('# await idle-promises');
        let count2 = 0;
        await Promise.all(
            new Array(1000)
                .fill(0)
                .map(() => {
                    return queue.requestIdlePromise()
                        .then(() => count2++);
                })
        );
        assert.equal(count2, 1000);

        const elapsed = elapsedTime(startTime);
        benchmark.wrapCalls = elapsed;
    });

    /**
    * add one long wrapCall
    * and await many idlePromises
    */
    it('deepIdle', async () => {
        const queue = new IdleQueue();
        let startTime = null;
        queue.wrapCall(
            () => getWaitPromise(300).then(() => startTime = AsyncTestUtil.performanceNow())
        );

        return new Promise(res => {
            let amount = 1000;
            for (let i = 0; i < amount; i++) {
                queue.requestIdlePromise().then(function () {
                    amount--;
                    if (amount === 0) done();
                });
            }
            function done() {
                const elapsed = elapsedTime(startTime);
                benchmark.deepIdle = elapsed;
                res();
            }
        });
    });

    /**
     * await idleness
     * then run a wrapped call
     */
    it('waitWrapped', async () => {
        const queue = new IdleQueue(1);
        const startTime = AsyncTestUtil.performanceNow();
        let amount = 1000;

        return new Promise(res => {
            for (let i = 0; i < amount; i++) {
                (async () => {
                    await queue.requestIdlePromise();
                    queue.wrapCall(
                        async () => {
                            await getWaitPromise(0);
                            amount--;
                            if (amount === 0) done();
                        }
                    );
                })();
            }

            function done() {
                queue.requestIdlePromise().then(() => {
                    assert.equal(amount, 0);
                    const elapsed = elapsedTime(startTime);
                    benchmark.waitWrapped = elapsed;
                    res();
                });
            }
        });
    });


    it('show result', () => {
        console.log('benchmark result:');
        console.log(JSON.stringify(benchmark, null, 2));
    });
});