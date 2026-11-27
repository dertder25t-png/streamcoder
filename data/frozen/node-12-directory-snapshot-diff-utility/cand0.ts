import { promises as fs } from 'node:fs';
import { join, relative, sep } from 'node:path';

interface FileComparisonResult {
  added: string[];
  removed: string[];
  modified: string[];
}

async function compareDirectories(dirA: string, dirB: string): Promise<FileComparisonResult> {
  const [filesA, filesB] = await Promise.all([fs.readdir(dirA, { withFileTypes: true }), fs.readdir(dirB, { withFileTypes: true })]);

  const fileMapA = new Map<string, Buffer>();
  const fileMapB = new Map<string, Buffer>();

  await Promise.all(
    filesA.filter(file => !file.isDirectory()).map(async file => {
      const filePath = join(dirA, file.name);
      fileMapA.set(relative(dirA, filePath), await fs.readFile(filePath));
    })
  );

  await Promise.all(
    filesB.filter(file => !file.isDirectory()).map(async file => {
      const filePath = join(dirB, file.name);
      fileMapB.set(relative(dirB, filePath), await fs.readFile(filePath));
    })
  );

  const added = Array.from(fileMapB.keys()).filter(file => !fileMapA.has(file));
  const removed = Array.from(fileMapA.keys()).filter(file => !fileMapB.has(file));
  const modified: string[] = [];

  for (const file of fileMapA.keys()) {
    if (fileMapB.has(file)) {
      const contentA = fileMapA.get(file)!;
      const contentB = fileMapB.get(file)!;
      if (!contentA.equals(contentB)) {
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

export { compareDirectories };
