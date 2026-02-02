export namespace Test {
  export async function run(
    name: string,
    count: number,
    serial: boolean,
    fn: () => any,
  ) {
    let macroTask = 0;
    const timeout = setInterval(() => {
      macroTask++;
    }, 100);
    let timeConsumings: number[] = [];
    timeConsumings.length = count;
    const testStartTime = Date.now();
    if (serial) {
      for (let i = 0; i < count; i++) {
        const time = Date.now();
        await fn();
        timeConsumings[i] = Date.now() - time;
      }
    } else {
      timeConsumings = [...timeConsumings];
      await Promise.all(
        timeConsumings.map((_, i) => {
          return new Promise((resolve) => {
            setImmediate(async () => {
              const time = Date.now();
              await fn();
              timeConsumings[i] = Date.now() - time;
              resolve(0);
            });
          });
        }),
      );
    }
    const testTime = Date.now() - testStartTime;
    clearInterval(timeout);
    if (count < 2) {
      return {
        name,
        count,
        macroTask,
        testTime,
      };
    }
    let total = 0;
    let highest = 0;
    let lowest = null;

    for (let i = 0; i < timeConsumings.length; i++) {
      const t = timeConsumings[i];
      if (lowest == null || t < lowest) {
        lowest = t;
      }
      highest = Math.max(t, highest);
      total += t;
    }

    const average = total / count;

    return {
      name,
      serial,
      count,
      macroTask,
      testTime,
      total,
      average,
      highest,
      lowest,
    };
  }

  export async function test(
    count: number,
    tasks: { name: string; fn: () => any }[],
  ) {
    const resList = [];
    if (count < 2) {
      for (const task of tasks) {
        resList.push(await run(task.name, count, true, task.fn));
      }
      console.table(resList, ["name", "macroTask", "testTime"]);
    } else {
      for (const task of tasks) {
        resList.push(await run(task.name, 1, true, task.fn));
        resList.push(await run(task.name, count, true, task.fn));
        resList.push(await run(task.name, count, false, task.fn));
      }
      console.table(resList, [
        "name",
        "serial",
        "count",
        "macroTask",
        "testTime",
        "total",
        "average",
        "highest",
        "lowest",
      ]);
    }
    return resList;
  }
}
