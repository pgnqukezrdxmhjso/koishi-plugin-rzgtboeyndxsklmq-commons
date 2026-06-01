import type { Awaitable, Context } from "koishi";
import { Objects } from "./Objects";

type Constructor<T = any> = new (...args: any[]) => T;

export class BeanHelper<C extends object> {
  static buildLazyProxyHandler<T extends object>(
    getObj: () => T,
    options?: BeanHelper.ProxyOptions,
  ) {
    const handlerMap: ProxyHandler<T> = {};
    let needInit = true;
    Reflect.ownKeys(Reflect).forEach((key) => {
      handlerMap[key] = (target: any, ...args: any[]) => {
        const obj = getObj();
        if (Objects.isNull(obj)) {
          return obj;
        }
        if (needInit) {
          needInit = false;
          Reflect.ownKeys(obj).forEach((k) => (target[k] = obj[k]));
          Reflect.setPrototypeOf(target, Reflect.getPrototypeOf(obj));
          target[BeanHelper.PlaceholderObject] = true;
        }
        if (key === "set") {
          Reflect.set(target, args[0], args[1]);
        } else if (key === "deleteProperty") {
          Reflect.deleteProperty(target, args[0]);
        }
        let res: any;
        if (key === "get") {
          res = options?.hooks?.get
            ? options.hooks.get(obj, args[0])
            : Reflect[key].apply(Reflect, [obj, args[0]]);
          if (typeof res === "function" && !options?.notBind) {
            res = res.bind(options?.bindOriginal ? obj : args[1]);
          }
        } else {
          res = Reflect[key].apply(Reflect, [obj, ...args]);
        }
        return res;
      };
    });
    return handlerMap;
  }

  static buildLazyProxy<T extends object>(
    getObj: () => T,
    options?: BeanHelper.ProxyOptions,
  ) {
    return new Proxy(
      {} as T,
      BeanHelper.buildLazyProxyHandler(getObj, options),
    );
  }

  private classPool: BeanHelper.ClassInfo<any>[] = [];
  ctx: Context;
  config: C;

  constructor() {
    this.proxy(() => this.ctx, "ctx", { notBind: true });
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
      if (classInfo.proxy instanceof BeanHelper.BeanType) {
        await classInfo.proxy.start();
      }
    }
  }

  async destroy() {
    for (const classInfo of this.classPool) {
      if (classInfo.proxy instanceof BeanHelper.BeanType) {
        await classInfo.proxy.destroy();
      }
    }
    this.classPool = null;
  }

  instance<T extends BeanHelper.BeanType<C>>(
    clazz: Constructor<T>,
    options?: BeanHelper.ProxyOptions,
  ): T {
    let classInfo: BeanHelper.ClassInfo<T> = this.classPool.find(
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
    };

    classInfo.proxy = BeanHelper.buildLazyProxy(() => {
      if (!classInfo.instance) {
        classInfo.instance = new classInfo.class(this);
      }
      return classInfo.instance;
    }, options);

    this.classPool.push(classInfo);
    return classInfo.proxy;
  }

  proxy<T extends object>(
    getObj: () => T,
    name: string,
    options?: BeanHelper.ProxyOptions,
  ) {
    const proxy = BeanHelper.buildLazyProxy(getObj, options);
    const classInfo: BeanHelper.ClassInfo<T> = {
      name,
      proxy,
    };

    this.classPool.push(classInfo);
    return classInfo.proxy;
  }

  getByName<T>(name: string): T {
    const classInfo: BeanHelper.ClassInfo<T> = this.classPool.find(
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

export namespace BeanHelper {
  export const PlaceholderObject = Symbol("PlaceholderObject");
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
  export interface ClassInfo<T> {
    name: string;
    class?: Constructor<T>;
    instance?: T;
    proxy?: T;
  }

  export interface ProxyOptions {
    notBind?: boolean;
    bindOriginal?: boolean;
    hooks?: {
      get: (obj: any, prop: PropertyKey) => any;
    };
  }
}
