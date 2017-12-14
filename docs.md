# Full Documentation

## constructor

```javascript
const myQueue = new IdleQueue(parallels);
```

### parallels

(Optional, default=1) If you set `parallels` higher than `1`, the queue will not be in idle-state as long as the limited-ressource is not used more than `parallels`-value in parrallel. It makes sense to use a higher number when your ressource can be used in parallel. For example when you do browser-requests, a typical browser can do `6` ajax-calls at the same time. Here you should set `parallels: 6` to ensure the limited-ressource is used as much as possible.

## isIdle()
Returns `true` if the queue is currently in idle-state. Returns `false` if not.

```js
myQueue.isIdle();
```

## lock()

Increases the lock-counter of the idle-queue. Each time the lock-counter is `0`, the queue is in idle-state.

```javascript

const unlock = myQueue.lock();
try{
    const result = await callToLimitedRessource();
    myQueue.unlock();
}catch(err){
    // do not forget to unlock not mather what happens
    myQueue.unlock();
    throw err;
}
```

## wrapCall()

Wraps a function-call into the lock/unlock-behavior. Use this so you dont have to manage the unlock manually.

```javascript
const result = myQueue.wrapCall(
    // takes a function as only parameter
    () => callToLimitedRessource()
);
```

## requestIdlePromise()

Returns a promise that resolves when the queue is in idle-state.

```javascript
const idlePromise = myQueue.requestIdlePromise(options /* optional */);
idlePromise.then(() => {
    // queue is now idle
    // run background task here
});
```

### options

(optional). You can pass an options-object which currently only has the `timeout`-attribute. When you set a timeout, the idlePromise will resolve after this time, even when the queue is not in idle.

```javascript
const idlePromise = myQueue.requestIdlePromise({
    timeout: 5000 // time in milliseconds
});
```

## cancelIdlePromise()

Cancels an idle-promise so it will not be resolved. Takes the promise from `requestIdlePromise` as parameter.

```javascript
const idlePromise = myQueue.requestIdlePromise();
myQueue.cancelIdlePromise(idlePromise);
```

## requestIdleCallback()

Runs the given callback when the queue is in idle.

```javascript
const callback = function(){
    // do something
};
myQueue.requestIdleCallback(callback, options);
```

## cancelIdleCallback()

Cancels the calling of `requestIdleCallback`. Takes returned number from `requestIdleCallback` as input.

```javascript
const callback = function(){
    // do something
};
const handleNumber = myQueue.requestIdleCallback(callback, options);
myQueue.cancelIdleCallback(handleNumber);
```

## clear()

Cancels all idle-promise and idle-callbacks. Also resets the queue-counter.

```javascript
myQueue.clear();
```
