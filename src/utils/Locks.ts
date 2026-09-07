export class CoalesceLock {
  private locks = new Map<PropertyKey, Promise<unknown>>();
  async run<T>(key: PropertyKey, fn: () => T | PromiseLike<T>): Promise<T> {
    const lock = this.locks.get(key);
    if (lock) {
      return lock as Promise<T>;
    }
    const promise = Promise.resolve()
      .then(fn)
      .finally(() => this.locks.delete(key));
    this.locks.set(key, promise);
    return promise;
  }
  async await<T>(key: PropertyKey): Promise<T | undefined> {
    const lock = this.locks.get(key);
    if (lock) {
      return (await lock) as T;
    }
  }
  locked(key: PropertyKey) {
    return this.locks.has(key);
  }
}

type Resolve<T = void> = (value: T | PromiseLike<T>) => void;
interface TaskQueueInfo {
  ing: Promise<void>;
  ingRes: Resolve;
  waiting: Resolve[];
}
export class TaskQueue {
  private queueMap = new Map<PropertyKey, TaskQueueInfo>();
  async run<T>(key: PropertyKey, fn: () => T | PromiseLike<T>) {
    let info = this.queueMap.get(key);
    if (!info) {
      info = {
        ing: undefined,
        ingRes: undefined,
        waiting: [],
      };
      info.ing = new Promise((res) => {
        info.ingRes = res;
      });
      this.queueMap.set(key, info);
    } else {
      await new Promise((res) => {
        info.waiting.push(res);
      });
    }

    try {
      return await fn();
    } finally {
      if (info.waiting.length === 0) {
        info.ingRes();
        this.queueMap.delete(key);
      } else {
        info.waiting.shift()();
      }
    }
  }
  async await(key: PropertyKey) {
    const info = this.queueMap.get(key);
    if (info?.ing) {
      await info.ing;
    }
  }
  running(key: PropertyKey) {
    return this.queueMap.has(key);
  }
}

interface ReadWriteLockInfo {
  readingMark: Record<symbol, true>;
  reading: Promise<void>;
  readingRes: Resolve;
  waiting: Resolve[];
  writing: Promise<void>;
  writingRes: Resolve;
}
export class ReadWriteLock {
  private locks = new Map<PropertyKey, ReadWriteLockInfo>();
  private getInfo(key: PropertyKey) {
    if (!this.locks.has(key)) {
      this.locks.set(key, {
        readingMark: {},
        reading: undefined,
        readingRes: undefined,
        waiting: [],
        writing: undefined,
        writingRes: undefined,
      });
    }
    return this.locks.get(key);
  }
  private rmInfo(key: PropertyKey) {
    setTimeout(() => {
      const info = this.locks.get(key);
      if (!info) {
        return;
      }
      if (!info.writing && !info.reading) {
        this.locks.delete(key);
      }
    }, 0);
  }
  async r<T>(key: PropertyKey, fn: () => T | Promise<T>): Promise<T> {
    let info = this.getInfo(key);
    if (info.writing) {
      await info.writing;
      info = this.getInfo(key);
    }
    if (!info.reading) {
      info.reading = new Promise((resolve) => {
        info.readingRes = resolve;
      });
    }
    const symbol = Symbol("read");
    info.readingMark[symbol] = true;
    try {
      return await fn();
    } finally {
      delete info.readingMark[symbol];
      if (Object.getOwnPropertySymbols(info.readingMark).length === 0) {
        info.readingRes();
        info.reading = null;
        info.readingRes = null;
        this.rmInfo(key);
      }
    }
  }
  async rAwait(key: PropertyKey) {
    const info = this.locks.get(key);
    if (info.reading) {
      await info.reading;
    }
  }
  rLocked(key: PropertyKey) {
    const info = this.locks.get(key);
    return !!info.reading;
  }
  async w<T>(key: PropertyKey, fn: () => T | Promise<T>): Promise<T> {
    let info = this.getInfo(key);
    if (info.reading) {
      await info.reading;
      info = this.getInfo(key);
    }
    if (!info.writing) {
      info.writing = new Promise((resolve) => {
        info.writingRes = resolve;
      });
    } else {
      let res: (value: void | PromiseLike<void>) => void;
      const lock = new Promise<void>((resolve) => (res = resolve));
      info.waiting.push(res);
      await lock;
    }
    try {
      return await fn();
    } finally {
      if (info.waiting.length === 0) {
        info.writingRes();
        info.writing = null;
        info.writingRes = null;
        this.rmInfo(key);
      } else {
        info.waiting.shift()();
      }
    }
  }
  async wAwait(key: PropertyKey) {
    const info = this.locks.get(key);
    if (info.writing) {
      await info.writing;
    }
  }
  wLocked(key: PropertyKey) {
    const info = this.locks.get(key);
    return !!info.writing;
  }
}
