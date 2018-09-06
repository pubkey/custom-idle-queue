const assert = require('assert');
const AsyncTestUtil = require('async-test-util');
const IdleQueue = require('../../');

const getWaitFunction = (time = 20) => () => AsyncTestUtil.wait(time);

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
            it('should increae the queue counter', () => {
                const queue = new IdleQueue();
                queue.lock();
                queue.lock();
                assert.equal(queue._qC, 2);
                queue.clear();
            });
            it('should have the correct lock-amount queue', () => {
                const queue = new IdleQueue();
                new Array(50)
                    .fill(0)
                    .map(() => queue.lock());
                assert.equal(queue._qC, 50);
                queue.clear();
            });
        });
        describe('.unlock()', () => {
            it('should descrease the queueCounter', () => {
                const queue = new IdleQueue();
                new Array(10)
                    .fill(0)
                    .map(() => queue.lock());
                assert.equal(queue._qC, 10);

                new Array(10)
                    .fill(0)
                    .map(() => queue.unlock());
                assert.equal(queue._qC, 0);
                queue.clear();
            });
        });
        describe('.isIdle()', () => {
            it('should by idle by default', () => {
                const queue = new IdleQueue();
                assert.ok(queue.isIdle());
                queue.clear();
            });
            it('should return false if not idle', () => {
                const queue = new IdleQueue();
                queue.lock();
                assert.equal(false, queue.isIdle());
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
                const queue = new IdleQueue();
                const promise = queue.wrapCall(
                    async() => {
                        await AsyncTestUtil.wait(100);
                        return 42;
                    }
                );
                assert.equal(queue._qC, 1);
                const res = await promise;
                assert.equal(res, 42);
                assert.equal(queue._qC, 0);
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
                assert.equal(queue._qC, 0);
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
            it('should not resolve with timeout', async() => {
                const queue = new IdleQueue();
                let resolved = false;
                const promise = queue.requestIdlePromise({
                    timeout: 10
                });
                promise.then(() => resolved = true);
                queue.cancelIdlePromise(promise);
                await AsyncTestUtil.wait(20);
                assert.ok(!resolved);
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
            it('should not resolve with timeout', async() => {
                const queue = new IdleQueue();
                let resolved = false;
                const handle = queue.requestIdleCallback(
                    () => resolved = true, {
                        timeout: 10
                    });
                queue.cancelIdleCallback(handle);
                await AsyncTestUtil.wait(20);
                assert.ok(!resolved);
                queue.clear();
            });
        });
        describe('parallels', () => {
            it('should run 2 in parrallel', async() => {
                const queue = new IdleQueue(2);
                assert.equal(queue._parallels, 2);
                let called = 0;
                queue.wrapCall(getWaitFunction(50));
                queue.requestIdlePromise().then(() => called++);
                await AsyncTestUtil.wait(10);
                assert.equal(called, 1);
                queue.clear();
            });
            it('should run 10 in parrallel', async() => {
                const queue = new IdleQueue(10);
                let called = 0;
                queue.wrapCall(getWaitFunction(10000));
                new Array(9).fill(0).forEach(() => {
                    queue.requestIdlePromise().then(() => {
                        called++;
                    });
                });
                await AsyncTestUtil.wait(100);
                assert.equal(called, 9);
                queue.clear();
            });
        });
        describe('other', () => {
            it('should have empty maps when all is done', async() => {
                const queue = new IdleQueue();
                let i = 0;

                await queue.wrapCall(
                    async() => {
                        await AsyncTestUtil.wait(100);
                        return 42;
                    }
                );

                const handle = queue.requestIdleCallback(
                    () => i++, {
                        timeout: 10
                    });
                queue.cancelIdleCallback(handle);
                queue.requestIdleCallback(
                    () => i++, {
                        timeout: 10
                    });

                await AsyncTestUtil.wait(50);

                assert.deepEqual(queue._iC.size, 0);
                assert.deepEqual(queue._hPM.size, 0);
                assert.deepEqual(queue._pHM.size, 0);

                queue.clear();
            });
        });
    });
    describe('e', () => {
        //        it('exit', () => process.exit());
    });
});
