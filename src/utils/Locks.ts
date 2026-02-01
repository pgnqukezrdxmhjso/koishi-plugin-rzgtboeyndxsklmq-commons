const pool = {
  coalesce: {},
  queue: {},
};
export namespace Locks {
  export async function coalesce(
    key: string | symbol,
    fn?: () => any | Promise<any>,
  ) {
    let lockObj = (pool.coalesce[key] ||= {
      lock: null,
      resolve: null,
      reject: null,
    });

    if (!fn || lockObj.lock) {
      return lockObj.lock;
    }

    lockObj.lock = new Promise((resolve, reject) => {
      lockObj.resolve = resolve;
      lockObj.reject = reject;
    });
    try {
      const res = await fn();
      lockObj.resolve(res);
      return res;
    } catch (e) {
      lockObj.reject(e);
      throw e;
    } finally {
      delete lockObj.lock;
      delete lockObj.resolve;
      delete lockObj.reject;
      delete pool.coalesce[key];
    }
  }
  export async function queue(
    key: string | symbol,
    fn?: () => any | Promise<any>,
  ) {
    let lockList: any[] = (pool.queue[key] ||= []);

    const lockObj = {
      lock: null,
      resolve: null,
      reject: null,
      fn,
    };
    lockObj.lock = new Promise((resolve, reject) => {
      lockObj.resolve = resolve;
      lockObj.reject = reject;
    });
    lockList.push(lockObj);
    if (lockList.length > 1) {
      return lockObj.lock;
    }

    const next = async () => {
      const lockObj = lockList[0];
      if (!lockObj) {
        return;
      }
      try {
        const res = await lockObj.fn();
        lockObj.resolve(res);
      } catch (e) {
        lockObj.reject(e);
      } finally {
        const index = lockList.findIndex((item) => item.lock === lockObj.lock);
        if (index >= 0) {
          lockList.splice(index, 1);
        }
        next().then();
      }
    };
    next().then();

    return lockObj.lock;
  }
}
