import { promises as fs } from 'node:fs';
import { sep } from 'node:path';

async function compareFiles(fileA: string, fileB: string): Promise<{ added: boolean; removed: boolean; modified: boolean }> {
    try {
        const statA = await fs.stat(fileA);
        const statB = await fs.stat(fileB);

        if (statA.mtimeMs !== statB.mtimeMs) return { added: false, removed: false, modified: true };

        const contentA = await fs.readFile(fileA);
        const contentB = await fs.readFile(fileB);

        return { added: false, removed: false, modified: contentA !== contentB };
    } catch (err) {
        if ((err as { code: string }).code === 'ENOENT') {
            return { added: false, removed: true, modified: false };
        }
        throw err;
    }
}

async function compareDirectories(dirA: string, dirB: string): Promise<{ added: string[]; removed: string[]; modified: string[] }> {
    const result = { added: [], removed: [], modified: [] };

    const filesA = new Set(await fs.readdir(dirA));
    const filesB = new Set(await fs.readdir(dirB));

    const compare = async (file: string, dir: string) => {
        const fullFile = dir + sep + file;
        const relativeFile = fullFile.replace(dirA + sep, '');

        if (!filesA.has(file)) {
            result.added.push(relativeFile);
        } else if (!filesB.has(file)) {
            result.removed.push(relativeFile);
        } else {
            const { added, removed, modified } = await compareFiles(fullFile, dirB + sep + file);
            if (added) result.added.push(relativeFile);
            if (removed) result.removed.push(relativeFile);
            if (modified) result.modified.push(relativeFile);
        }
    };

    for (const file of filesA) compare(file, dirA);
    for (const file of filesB) compare(file, dirB);

    result.added.sort();
    result.removed.sort();
    result.modified.sort();

    return result;
}

export { compareDirectories };
