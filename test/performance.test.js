/**
 * this runs some performance-test and measures the time
 */

const assert = require('assert');
const IdleQueue = require('../');


console.log('# start performance-test:');

let count = 0;
const getWaitPromise = () => {
    return new Promise(res => {
        setTimeout(() => {
            res();
            count++;
        }, 1);
    });
};
let count3 = 0;

const run = async () => {
    console.time('aa');
    const queue = new IdleQueue();

    for (let i = 0; i < 10000; i++) {
        queue.wrapCall(
            () => count3++
        );
    }

    const wrappedCall = () => queue.wrapCall(
        getWaitPromise
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

    console.timeEnd('aa');
};

run();
