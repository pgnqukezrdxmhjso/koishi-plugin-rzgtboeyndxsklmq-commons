export namespace Test {
  export async function test(
    name: string,
    count: number,
    serial: boolean,
    run: () => any,
  ) {
    const timeout = setInterval(() => {
      process.stdout.write(".");
    }, 100);
    let timeConsumings: number[] = [];
    timeConsumings.length = count;
    const testStartTime = Date.now();
    if (serial) {
      for (let i = 0; i < count; i++) {
        const time = Date.now();
        await run();
        timeConsumings[i] = Date.now() - time;
      }
    } else {
      timeConsumings = [...timeConsumings];
      await Promise.all(
        timeConsumings.map((_, i) => {
          return new Promise((resolve) => {
            setImmediate(async () => {
              const time = Date.now();
              await run();
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
      console.log(`\nrun: ${name};\ttotal: ${timeConsumings[0]};`);
      return;
    }
    let total = 0;
    let average = 0;
    let highest = 0;
    let lowest = null;

    for (let i = 1; i < timeConsumings.length; i++) {
      const t = timeConsumings[i];
      if (lowest == null || t < lowest) {
        lowest = t;
      }
      highest = Math.max(t, highest);
      total += t;
    }
    average = total / (count - 1);

    console.log(
      `\nrun: ${name};\tserial: ${serial};\tcount: ${count};\ttestTime: ${testTime};\ttotal: ${total};\tfirst: ${timeConsumings[0]};\taverage: ${average};\thighest: ${highest};\tlowest: ${lowest};`,
    );
  }

  export async function test2(name: string, count: number, run: () => any) {
    await test(name, count, true, run);
    await test(name, count, false, run);
  }
}
