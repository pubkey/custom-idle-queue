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
    cancelIdlePromise(prom: Promise<void>): void;

    requestIdleCallback(cb: Function, options: Options): number;
    cancelIdleCallback(handle: number): void;

    clear(): void;
}


export default IdleQueue;
