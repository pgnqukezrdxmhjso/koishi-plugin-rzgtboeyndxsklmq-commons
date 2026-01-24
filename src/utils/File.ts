import fs from "node:fs/promises";
import path from "node:path";

export async function readDirFiles(dirPath: string, needDir: boolean = false) {
  const files = await fs.readdir(dirPath, {
    recursive: true,
    withFileTypes: true,
  });
  const paths: string[] = [];
  files.forEach((file) => {
    if (file.isDirectory()) {
      if (!needDir) {
        return;
      }
      paths.push(path.join(file.parentPath, file.name, path.sep));
    } else if (file.isFile()) {
      paths.push(path.join(file.parentPath, file.name));
    }
  });
  return paths;
}
