import { promises as fs } from 'node:fs';
import { join, relative, sep } from 'node:path';

interface FileComparisonResult {
  added: string[];
  removed: string[];
  modified: string[];
}

async function compareFiles(fileA: string, fileB: string): Promise<'identical' | 'different'> {
  const [contentA, contentB] = await Promise.all([fs.readFile(fileA), fs.readFile(fileB)]);
  return contentA.equals(contentB) ? 'identical' : 'different';
}

async function compareDirectories(dirA: string, dirB: string): Promise<FileComparisonResult> {
  const result: FileComparisonResult = { added: [], removed: [], modified: [] };

  const [filesA, filesB] = await Promise.all([
    fs.readdir(dirA, { withFileTypes: true }),
    fs.readdir(dirB, { withFileTypes: true }),
  ]);

  const fileMapA = new Map(filesA.map(file => [file.name, file]));
  const fileMapB = new Map(filesB.map(file => [file.name, file]));

  for (const [name, fileA] of fileMapA) {
    const fileB = fileMapB.get(name);
    if (!fileB) {
      result.removed.push(relative(dirA, join(dirA, name)));
    } else {
      const filePathA = join(dirA, name);
      const filePathB = join(dirB, name);
      const comparison = await compareFiles(filePathA, filePathB);
      if (comparison === 'different') {
        result.modified.push(relative(dirA, filePathA));
      }
    }
  }

  for (const [name, fileB] of fileMapB) {
    if (!fileMapA.has(name)) {
      result.added.push(relative(dirB, join(dirB, name)));
    }
  }

  return result;
}

export { compareDirectories };
