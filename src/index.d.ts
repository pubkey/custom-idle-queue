interface options {
    timeout?: number
}

declare class IdleQueue {
    constructor(parallels?: number);
    lock(): Function;

    wrapCall(fun: Function): any;

    requestIdlePromise(options): Promise<void>;
    cancelIdlePromise(prom: Promise<void>);

    requestIdleCallback(cb: Function, options): number;
    cancelIdleCallback(handle: number);
}


export default IdleQueue;
