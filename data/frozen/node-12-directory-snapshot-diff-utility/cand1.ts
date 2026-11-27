import { promises as fs, Stats } from 'node:fs';
import path from 'node:path';

async function compareDirectories(dirA: string, dirB: string): Promise<{ added: string[]; removed: string[]; modified: string[] }> {
  const [filesA, filesB] = await Promise.all([fs.readdir(dirA, { withFileTypes: true }), fs.readdir(dirB, { withFileTypes: true })]);

  const fileMapA = new Map<string, Buffer>();
  const fileMapB = new Map<string, Buffer>();

  await Promise.all(
    filesA.map(async (file) => {
      const filePath = path.join(dirA, file.name);
      if (file.isFile()) {
        fileMapA.set(filePath, await fs.readFile(filePath));
      }
    })
  );

  await Promise.all(
    filesB.map(async (file) => {
      const filePath = path.join(dirB, file.name);
      if (file.isFile()) {
        fileMapB.set(filePath, await fs.readFile(filePath));
      }
    })
  );

  const added = Array.from(fileMapB.keys()).filter((file) => !fileMapA.has(file));
  const removed = Array.from(fileMapA.keys()).filter((file) => !fileMapB.has(file));
  const modified: string[] = [];

  for (const file of fileMapA.keys()) {
    if (fileMapB.has(file)) {
      if (!fileMapA.get(file)?.equals(fileMapB.get(file))) {
        modified.push(file);
      }
    }
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    modified: modified.sort(),
  };
}
