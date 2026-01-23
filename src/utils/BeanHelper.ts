import type { Context, Awaitable } from "koishi";

export abstract class BeanType<C extends object> {
  protected ctx: Context;
  protected config: C;
  constructor(protected beanHelper: BeanHelper<C>) {
    this.ctx = beanHelper.getByName("ctx");
    this.config = beanHelper.getByName("config");
    return this;
  }

  start(): Awaitable<void> {}
  destroy(): Awaitable<void> {}
}

type Constructor<T = any> = new (...args: any[]) => T;

export interface ClassInfo<T> {
  name: string;
  class?: Constructor<T>;
  instance?: T;
  proxy?: T;
  proxyRevoke?: () => void;
}

export class BeanHelper<C extends object> {
  static buildLazyProxyHandler<T extends object>(
    getObj: () => T,
    hooks?: {
      get: (obj: any, prop: PropertyKey) => any;
    },
  ) {
    const handlerMap: ProxyHandler<T> = {};
    let needInit = true;
    Reflect.ownKeys(Reflect).forEach((key) => {
      handlerMap[key] = (target: any, ...args: any[]) => {
        const obj = getObj();
        if (needInit) {
          needInit = false;
          Reflect.ownKeys(obj).forEach((k) => (target[k] = obj[k]));
          Reflect.setPrototypeOf(target, Reflect.getPrototypeOf(obj));
        }
        if (key === "set") {
          Reflect[key].apply(Reflect, [target, args[0], args[1]]);
        } else if (key === "deleteProperty") {
          Reflect[key].apply(Reflect, [target, args]);
        }
        let res: any;
        if (key === "get") {
          res = hooks?.get
            ? hooks.get(obj, args[0])
            : Reflect[key].apply(Reflect, [obj, args[0]]);
          if (typeof res === "function") {
            res = res.bind(args[1]);
          }
        } else {
          res = Reflect[key].apply(Reflect, [obj, ...args]);
        }
        return res;
      };
    });
    return handlerMap;
  }

  static buildLazyProxy<T extends object>(getObj: () => T) {
    return new Proxy({} as T, BeanHelper.buildLazyProxyHandler(getObj));
  }

  static buildLazyRevocableProxy<T extends object>(getObj: () => T) {
    return Proxy.revocable({} as T, BeanHelper.buildLazyProxyHandler(getObj));
  }

  private classPool: ClassInfo<any>[] = [];
  ctx: Context;
  config: C;

  constructor() {
    this.proxy(() => this.ctx, "ctx");
    this.proxy(() => this.config, "config");
  }

  setCtx(ctx: Context, config: C) {
    this.ctx = ctx;
    this.config = config;
  }

  private touchAll() {
    let i = 0;
    let len = 0;
    while (len != this.classPool.length && i++ < 99999) {
      len = this.classPool.length;
      this.classPool.forEach((classInfo) => {
        return classInfo?.proxy?.["__"];
      });
    }
  }

  async start() {
    this.touchAll();
    for (const classInfo of this.classPool) {
      if (classInfo.proxy instanceof BeanType) {
        await classInfo.proxy.start();
      }
    }
  }

  async destroy() {
    for (const classInfo of this.classPool) {
      if (classInfo.proxy instanceof BeanType) {
        await classInfo.proxy.destroy();
      }
      classInfo.proxyRevoke?.();
    }
    this.classPool = null;
  }

  instance<T extends BeanType<C>>(clazz: Constructor<T>): T {
    let classInfo: ClassInfo<T> = this.classPool.find(
      (classInfo) => classInfo.class === clazz,
    );
    if (classInfo) {
      return classInfo.proxy;
    }
    classInfo = {
      name: clazz.name,
      class: clazz,
      instance: null,
      proxy: null,
      proxyRevoke: null,
    };

    const proxyRevocable = BeanHelper.buildLazyRevocableProxy(() => {
      if (!classInfo.instance) {
        classInfo.instance = new classInfo.class(this);
      }
      return classInfo.instance;
    });
    classInfo.proxy = proxyRevocable.proxy;
    classInfo.proxyRevoke = proxyRevocable.revoke;

    this.classPool.push(classInfo);
    return classInfo.proxy;
  }

  proxy<T extends object>(getObj: () => T, name: string) {
    const proxyRevocable = BeanHelper.buildLazyRevocableProxy(getObj);
    const classInfo: ClassInfo<T> = {
      name,
      proxy: proxyRevocable.proxy,
      proxyRevoke: proxyRevocable.revoke,
    };

    this.classPool.push(classInfo);
    return classInfo.proxy;
  }

  getByName<T>(name: string): T {
    const classInfo: ClassInfo<T> = this.classPool.find(
      (classInfo) => classInfo.name === name,
    );
    return classInfo.proxy || classInfo.instance;
  }

  put<T>(instance: T, name?: string, clazz?: Constructor) {
    if (!clazz) {
      clazz = instance.constructor as any;
    }
    if (!name) {
      name = clazz.name;
    }
    this.classPool.push({
      name: name,
      class: clazz,
      instance: instance,
    });
    return instance;
  }
}
