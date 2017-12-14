/**
 * this runs some performance-test and measures the time
 */

const AsyncTestUtil = require('async-test-util');
const assert = require('assert');
const IdleQueue = require('../');


console.log('# start performance-test:');



const run = async () => {
    console.time('aa');
    const queue = new IdleQueue();

    let count = 0;

    const wrappedCall = () => queue.wrapCall(
        async () => {
            await AsyncTestUtil.wait(10);
            count++;
        }
    );

    new Array(100000).fill(0).forEach(() => wrappedCall());
    console.log('# run wrapped calls');
    await queue.requestIdlePromise();
    assert.equal(count, 100000);

    await queue.requestIdlePromise();

    console.log('# await idle-promises');
    let count2 = 0;
    await Promise.all(
        new Array(1000)
        .fill(0)
        .map(async () => {
            await queue.requestIdlePromise();
            count2++;
        })
    );
    assert.equal(count2, 1000);

    console.timeEnd('aa');
};

run();
