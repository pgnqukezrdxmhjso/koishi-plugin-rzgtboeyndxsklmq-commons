export namespace Objects {
  export type Null = null | undefined;
  export type Empty = Null | Record<string, never> | [];

  export function isNull(obj: any): obj is Null {
    return obj === null || obj === undefined;
  }

  export function isNotNull<T>(obj: T): obj is Exclude<T, Null> {
    return !Objects.isNull(obj);
  }
  export function isEmpty(obj: any): obj is Empty {
    return (
      Objects.isNull(obj) ||
      (typeof obj === "object" && Object.keys(obj).length < 1)
    );
  }
  export function isNotEmpty<T>(obj: T): obj is Exclude<T, Empty> {
    return !Objects.isEmpty(obj);
  }

  /**
   * @deprecated deepForEach
   */
  export async function thoroughForEach(
    obj: any,
    fn: (
      value: any,
      key: PropertyKey,
      obj: any,
      keys: PropertyKey[],
      root: any,
    ) => Promise<void> | void,
    all: boolean = false,
    keys: PropertyKey[] = [],
    root?: any,
  ) {
    if (!root) {
      root = obj;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof Object) {
        if (all) {
          await fn(value, key, obj, keys, root);
        }
        await Objects.thoroughForEach(value, fn, all, [...keys, key], root);
      } else {
        await fn(value, key, obj, keys, root);
      }
    }
  }
  export async function deepForEach(
    obj: any,
    fn: (
      value: any,
      key: string,
      obj: any,
      parentPath: string[],
      root: any,
    ) => Promise<void | false> | void | false,
    {
      onObject = true,
      onValue = true,
      parentPath = [] as string[],
      root = obj,
    } = {},
  ) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        if (onObject) {
          if (await fn(value, key, obj, parentPath, root) === false) {
            return false
          }
        }
        if (await deepForEach(value, fn, {
          onObject,
          onValue,
          parentPath: [...parentPath, key],
          root,
        }) === false) {
          return false
        }
      }
      else if (onValue) {
        if (await fn(value, key, obj, parentPath, root) === false) {
          return false
        }
      }
    }
  }

  export async function clone<T>(
    sourceObj: T,
    filter?: (
      value: any,
      key: PropertyKey,
      obj: any,
    ) => boolean | Promise<boolean>,
    alreadyObjPool = new WeakMap<any, any>(),
  ): Promise<T> {
    if (sourceObj === null || typeof sourceObj !== "object") {
      return sourceObj;
    }

    if (alreadyObjPool.has(sourceObj)) {
      return alreadyObjPool.get(sourceObj);
    }

    if (Array.isArray(sourceObj)) {
      const list = [];
      alreadyObjPool.set(sourceObj, list);
      for (let i = 0; i < sourceObj.length; i++) {
        const item = sourceObj[i];
        if (filter && !(await filter(item, i, sourceObj))) {
          continue;
        }
        list.push(await this.clone(item, filter, alreadyObjPool));
      }
      return list as T;
    }
    if (sourceObj?.constructor === Object) {
      const obj: Record<any, any> = {};
      alreadyObjPool.set(sourceObj, obj);
      for (const [key, item] of Object.entries(sourceObj)) {
        if (filter && !(await filter(item, key, sourceObj))) {
          continue;
        }
        obj[key] = await this.clone(item, filter, alreadyObjPool);
      }
      return obj as T;
    }
    return sourceObj;
  }
  export function flatten(
    data: any,
    rootElements: any[] = [],
    alreadyObjPool = new WeakSet<any>(),
  ): any[] {
    if (Objects.isNull(data)) {
      return rootElements;
    }
    if (typeof data === "object") {
      if (alreadyObjPool.has(data)) {
        return rootElements;
      }
      alreadyObjPool.add(data);
      for (const item of Object.values(data)) {
        Objects.flatten(item, rootElements, alreadyObjPool);
      }
    } else {
      rootElements.push(data);
    }
    return rootElements;
  }
  export function parseKeyPath(keyPath: string) {
    const r =
      /((?:\?\.)?\[(?:\d+|'(?:.(?:(?<=\\')|(?<!')))*?(?<!\\)'|"(?:.(?:(?<=\\")|(?<!")))*?(?<!\\)"|`(?:.(?:(?<=\\`)|(?<!`)))*?(?<!\\)`)?])|((?:\??\.|^)[^[\]?.'"`]+)|(.)/g;
    const msa = [...keyPath.matchAll(r)];
    const keys: string[] = [];
    const abnormal: string[] = [];
    let inAbnormal = false;
    for (const row of msa) {
      if (!row[3]) {
        inAbnormal = false;
        keys.push(row[0]);
        continue;
      }
      if (!inAbnormal) {
        inAbnormal = true;
        abnormal.push("");
      }
      abnormal[abnormal.length - 1] += row[0];
    }
    const rawKeys = [...keys];

    const regMap = {
      "'": [/^\['|']$/g, /\\'/g],
      '"': [/^\["|"]$/g, /\\"/g],
      "`": [/^\[`|`]$/g, /\\`/g],
    };

    for (let i = 0; i < keys.length; i++) {
      keys[i] = keys[i].replace(/\??\./, "");
      if (keys[i] === "[]") {
        keys[i] = "__For_Each__";
      } else if (/^\[.+]$/.test(keys[i])) {
        const s = keys[i][1];
        if (["'", '"', "`"].includes(s)) {
          keys[i] = keys[i].replace(regMap[s][0], "").replace(regMap[s][1], s);
        } else {
          keys[i] = keys[i].replace(/^\[|]$/g, "");
        }
      }
    }
    return {
      rawKeys,
      keys,
      abnormal,
    };
  }
  export function getValuesByPath(obj: any, keyPath: string): any {
    const { keys } = Objects.parseKeyPath(keyPath);
    let target = obj;
    let forEach = false;
    for (const key of keys) {
      if (!forEach) {
        if (key === "__For_Each__") {
          forEach = true;
          target = Object.values(target ?? []);
        } else {
          target = target?.[key];
        }
        continue;
      }

      if (typeof target[Symbol.iterator] !== "function") {
        break;
      }

      const newTargets = [];
      for (const item of target) {
        if (!(item instanceof Object)) {
          continue;
        }
        if (key === "__For_Each__") {
          newTargets.push(...Object.values(item ?? []));
        } else if (key in item) {
          newTargets.push(item[key]);
        }
      }
      target = newTargets;
    }
    return target;
  }
}
