interface Options {
    timeout?: number
}

declare class IdleQueue {
    constructor(parallels?: number);

    isIdle(): boolean;
    lock(): void;
    unlock(): void;

    wrapCall(fun: Function): Promise<any>;

    requestIdlePromise(options?: Options): Promise<void>;
    cancelIdlePromise(prom: Promise<void>);

    requestIdleCallback(cb: Function, options: Options): number;
    cancelIdleCallback(handle: number);

    clear(): void;
}


export default IdleQueue;
