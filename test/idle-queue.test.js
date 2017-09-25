const assert = require('assert');
const AsyncTestUtil = require('async-test-util');
const IdleQueue = require('../');

describe('idle-queue.test.js', () => {

    describe('statics', () => {
        describe('create()', () => {
            it('should create a queue', () => {
                const queue = new IdleQueue();
                assert.ok(queue);
            });
        });
    });
    describe('instance', () => {
        describe('.lock()', () => {
            it('should get a unlock-function while increasing the _queueCounter', () => {
                const queue = new IdleQueue();
                const unlock1 = queue.lock();
                const unlock2 = queue.lock();
                assert.equal(typeof unlock1, 'function');
                assert.equal(typeof unlock2, 'function');
                assert.equal(queue._queueCounter, 2);
                queue.clear();
            });
            it('should have the correct lock-amount queue', () => {
                const queue = new IdleQueue();
                new Array(50)
                    .fill(0)
                    .map(() => queue.lock());
                assert.equal(queue._queueCounter, 50);
                queue.clear();
            });
        });
        describe('.unlock()', () => {
            it('should not crash when calling unlock', async() => {
                const queue = new IdleQueue();
                const unlock = queue.lock();
                unlock();
                queue.clear();
            });
            it('should have an empty queue when unlocked', () => {
                const queue = new IdleQueue();
                const unlocks = new Array(10)
                    .fill(0)
                    .map(() => queue.lock());
                assert.equal(queue._queueCounter, 10);
                unlocks.forEach(unlock => unlock());
                assert.equal(queue._queueCounter, 0);
                queue.clear();
            });
            it('should not contain the single unlocked nr', () => {
                const queue = new IdleQueue();
                new Array(10)
                    .fill(0)
                    .map(() => queue.lock());
                const unlock = queue.lock();
                new Array(10)
                    .fill(0)
                    .map(() => queue.lock());

                assert.equal(queue._queueCounter, 21);
                unlock();
                assert.equal(queue._queueCounter, 20);
                queue.clear();
            });
        });
        describe('.wrapCall()', () => {
            it('should call the given function and returns the value', async() => {
                const queue = new IdleQueue();
                const res = await queue.wrapCall(
                    () => 21 + 21
                );
                assert.equal(res, 42);
                queue.clear();
            });
            it('should have a lock while running the function', async() => {
                console.log('---------------');
                const queue = new IdleQueue();
                const promise = queue.wrapCall(
                    async() => {
                        await AsyncTestUtil.wait(100);
                        return 42;
                    }
                );
                console.log('x: ' + queue._queueCounter);
                assert.equal(queue._queueCounter, 1);
                const res = await promise;
                assert.equal(res, 42);
                assert.equal(queue._queueCounter, 0);
                queue.clear();
            });
            it('should pass the error if function throws', async() => {
                const queue = new IdleQueue();
                let thrown = false;
                try {
                    await queue.wrapCall(
                        async() => {
                            const throwMe = new Error('foobar');
                            throwMe.flag = true;
                            throw throwMe;
                        }
                    );
                } catch (err) {
                    thrown = true;
                    assert.ok(err.flag);
                }
                assert.ok(thrown);
                assert.equal(queue._queueCounter, 0);
                queue.clear();
            });
        });
        describe('.requestIdlePromise()', () => {
            it('should resolve the promise', async() => {
                const queue = new IdleQueue();
                await queue.requestIdlePromise();
                await AsyncTestUtil.wait(10);
                queue.clear();
            });
            it('should resolve the oldest first', async() => {
                const queue = new IdleQueue();
                const order = [];
                console.log('yyy');
                queue.requestIdlePromise().then(() => order.push(0));
                queue.requestIdlePromise().then(() => order.push(1));
                await AsyncTestUtil.wait();
                queue.requestIdlePromise().then(() => order.push(2));
                await AsyncTestUtil.waitUntil(() => order.length === 3);
                assert.deepEqual(order, [0, 1, 2]);
                queue.clear();
            });
            it('should resolve after timeout', async() => {
                const queue = new IdleQueue();
                queue.wrapCall(
                    () => AsyncTestUtil.wait(200000)
                );
                let done = false;
                queue.requestIdlePromise({
                    timeout: 50
                }).then(() => done = true);
                await AsyncTestUtil.waitUntil(() => done === true);
                queue.clear();
            });
            it('should not exec twice when timeout set', async() => {
                const queue = new IdleQueue();
                queue.wrapCall(
                    () => AsyncTestUtil.wait(20)
                );
                let done = 0;
                queue.requestIdlePromise({
                    timeout: 50
                }).then(() => done = done + 1);
                await AsyncTestUtil.wait(150);
                assert.equal(done, 1);
                queue.clear();
            });
        });
        describe('.cancelIdlePromise()', () => {
            it('should not resolve the promise', async() => {
                const queue = new IdleQueue();
                let resolved = false;
                const promise = queue.requestIdlePromise();
                promise.then(() => resolved = true);
                queue.cancelIdlePromise(promise);
                await AsyncTestUtil.wait(10);
                assert.equal(resolved, false);
                queue.clear();
            });
            it('should not crash when called twice on same promise', async() => {
                const queue = new IdleQueue();
                const promise = queue.requestIdlePromise();
                promise.then(() => resolved = true);
                queue.cancelIdlePromise(promise);
                queue.cancelIdlePromise(promise);
                queue.clear();
            });
            it('should not crash when giving a random promise', async() => {
                const queue = new IdleQueue();
                const randomPromise = AsyncTestUtil.wait(10);
                queue.cancelIdlePromise(randomPromise);
                queue.clear();
            });
        });
        describe('.requestIdleCallback()', () => {
            it('should run the callback', async() => {
                const queue = new IdleQueue();
                let run = false;
                await queue.requestIdleCallback(() => run = true);
                await AsyncTestUtil.wait(10);
                assert.ok(run);
                queue.clear();
            });
            it('should resolve the oldest first', async() => {
                const queue = new IdleQueue();
                const order = [];
                console.log('yyy');
                queue.requestIdleCallback(() => order.push(0));
                queue.requestIdleCallback(() => order.push(1));
                await AsyncTestUtil.wait();
                queue.requestIdleCallback(() => order.push(2));
                await AsyncTestUtil.waitUntil(() => order.length === 3);
                assert.deepEqual(order, [0, 1, 2]);
                queue.clear();
            });
            it('should resolve after timeout', async() => {
                const queue = new IdleQueue();
                queue.wrapCall(
                    () => AsyncTestUtil.wait(200000)
                );
                let done = false;
                queue.requestIdleCallback(() => done = true, {
                    timeout: 50
                });
                await AsyncTestUtil.waitUntil(() => done === true);
                queue.clear();
            });
            it('should not exec twice when timeout set', async() => {
                const queue = new IdleQueue();
                queue.wrapCall(
                    () => AsyncTestUtil.wait(100)
                );
                let done = 0;
                queue.requestIdleCallback(() => done = done + 1, {
                    timeout: 50
                });
                await AsyncTestUtil.wait(150);
                assert.equal(done, 1);
                queue.clear();
            });
        });
        describe('.cancelIdleCallback()', () => {
            it('should not resolve the promise', async() => {
                const queue = new IdleQueue();
                let resolved = false;
                const handle = queue.requestIdleCallback(() => resolved = true);
                assert.equal(typeof handle, 'number');
                queue.cancelIdleCallback(handle);
                await AsyncTestUtil.wait(10);
                assert.equal(resolved, false);
                queue.clear();
            });
            it('should not crash when called twice on same handle', async() => {
                const queue = new IdleQueue();
                let resolved = false;
                const handle = queue.requestIdleCallback(() => resolved = true);
                queue.cancelIdleCallback(handle);
                queue.cancelIdleCallback(handle);
                assert.equal(resolved, false);
                queue.clear();
            });
            it('should not crash when giving a random handle', async() => {
                const queue = new IdleQueue();
                queue.cancelIdleCallback(1337);
                queue.clear();
            });
        });
    });
    describe('e', () => {
        //        it('exit', () => process.exit());
    });
});
