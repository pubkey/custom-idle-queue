# Custom Idle Queue

This is a npm-module that lets you optimize the performance of important tasks by delaying background-tasks. It works a bit like [requestIdleCallback](https://developer.mozilla.org/de/docs/Web/API/Window/requestIdleCallback) but instead of fetching idle-time of the CPU, you can use this for any given limited ressource.

## Quickstart

In this example we define `database-requests` as limited ressource. We create an idleQueue arround all calls to the ressource to ensure our `importantTask` is as fast as possible and the `backgroundTask` only runs when no `importantTask` is using the database.

`npm install custom-idle-queue --save`

```javascript
// require
const { IdleQueue } = require('custom-idle-queue');

// OR import
import { IdleQueue } from 'custom-idle-queue';

// create a new queue
const myQueue = new IdleQueue();


// wrap all calls to your limited ressource
const readFromDatabase = key => myQueue.wrapCall(
    () => pseudoDatabaseModule.get(key)
);
const writeToDatabase = (key, value) => myQueue.wrapCall(
    () => pseudoDatabaseModule.set(key, value);
);
const deleteFromDatabase = (key) => myQueue.wrapCall(
    () => pseudoDatabaseModule.delete(key, value);
);

// this is the important task
const importantTask = async function increaseClickNumber() {
    const oldNumber = await readFromDatabase('nr');
    const newNumber = oldNumber++;
    await writeToDatabase('nr', newNumber);
    await writeToDatabase('time_' + newNumber, new Date().getTime());
    return newNumber;
};

// this is the background task
const backgroundTask = async function cleanUpOldClicks() {
    const newest = await readFromDatabase('nr');
    const limitDate = new Date().getTime() - 1000*60*60;
    for (let i = 0; i < newest; i++) {
        const date = await readFromDatabase('time_' + i);
        if(date < limitDate){
            await deleteFromDatabase('time_' + i);
        }
    }
}

// we now run the backgroundTask in an intervall without slowing down the importantTask
(async() => {
    while(true){
        await myQueue.requestIdlePromise(); // wait until database-requests in idle
        await backgroundTask();

        await new Promise(res => setTimeout(res, 2000)); // wait 2 seconds
    }
})();

// if we now run the importantTask, it will not be slowed down by the backgroundTask
document
    .querySelector('#myButton')
    .addEventListener('click', () => {
        const newNr = await importantTask();
        labelDomElement.innerHTML = newNr.toString();
    });

// You can find the full documentation here https://github.com/pubkey/custom-idle-queue/blob/master/docs.md

```

## Use cases
This module can be used on any limited ressource like

- HTTP-Requests
- Database-Calls
- Service-Worker-Calls
- Animations

## Limitations

- **IdleQueue cannot predict the future**

When you start a `backgroundTask` first and the `importantTask` afterwards, the `backgroundTask` will slow down the `importantTask` because it is already running. To prevent this, you should use `requestIdlePromise` as granular as possible. The backgroundTask-function from the example would be better when it awaits the idle-state before each usage of the limited ressource. This will ensure that the `backgroundTask` will be paused until the `importantTask` has finished.

```js
// this is the background task
const backgroundTask = async function cleanUpOldClicks() {
    await myQueue.requestIdlePromise(); // request idle-state each time
    const newest = await readFromDatabase('nr');
    const limitDate = new Date().getTime() - 1000*60*60;
    for (let i = 0; i < newest; i++) {
        await myQueue.requestIdlePromise(); // request idle-state each time
        const date = await readFromDatabase('time_' + i);
        if(date < limitDate){
            await myQueue.requestIdlePromise(); // request idle-state each time
            await deleteFromDatabase('time_' + i);
        }
    }
}
```

- **You cannot optimize CPU-only ressources**

Because javascript runs in a single process, it doesn't make sense to define CPU as limited ressource. For example if you have a CPU-only-Function like `calculatePrimeNumber`, you should not limit the access to the function with an idle-queue because at the time you call `idleQueue.lock()` or `idleQueue.wrapCall()`, the process will instantly run `calculatePrimeNumber` before it even can change the idle-queue state.



## Browser-Support

This module is using the [Promise-](https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Promise) and the [Map](https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Map)-Object. If your runtime does not support them, you have to add them via polyfills.

## [Read the full documentation here](https://github.com/pubkey/custom-idle-queue/blob/master/docs.md) 
