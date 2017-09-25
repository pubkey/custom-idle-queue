# custom-idle-queue

This is a npm-module that lets you optimize the performance of important tasks by delaying background-tasks. It works a bit like [requestIdleCallback](https://developer.mozilla.org/de/docs/Web/API/Window/requestIdleCallback) but instead of fetching idle-time of the CPU, you can use this for any given limited ressource.

## Quickstart

In this example we define `database-requests` as limited ressource. We create an idleQueue arround all calls to the ressource to ensure our `importantTask` is as fast as possible and the `backgroundTask` only runs when no `importantTask` is using the database.

`npm install custom-idle-queue --save`

```javascript
// import
const IdleQueue = require('custom-idle-queue');

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

```

## Use cases
This module can be used on any limited ressource like

- HTTP-Requests
- Database-Calls
- Service-Worker-Calls
- Animations
- Heavy Calculations


## Browser-Support

This module is using the [Promise](https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Promise) and the [Map](https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Map)-Object. If your runtime does not support them, you have to add them via polyfills.
