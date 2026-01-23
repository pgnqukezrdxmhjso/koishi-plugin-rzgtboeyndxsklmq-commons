import fs from "node:fs/promises";
import path from "node:path";

export async function readDirFiles(dirPath: string, needDir: boolean = false) {
  const files = await fs.readdir(dirPath, {
    withFileTypes: true,
  });
  const paths: string[] = [];
  files.sort((a, b) => (a.isFile() ? 1 : 0) - (b.isFile() ? 1 : 0));
  for (const file of files) {
    if (file.isDirectory()) {
      if (needDir) {
        paths.push(path.join(path.resolve(dirPath, file.name), path.sep));
      }
      paths.push(...(await readDirFiles(path.join(dirPath, file.name))));
    } else if (file.isFile()) {
      paths.push(path.resolve(dirPath, file.name));
    }
  }
  return paths;
}
