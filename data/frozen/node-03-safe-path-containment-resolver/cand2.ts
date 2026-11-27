import { resolve, isAbsolute, sep } from 'path';

export function resolveInsideRoot(rootDir: string, userPath: string): string {
    if (userPath.includes('\0')) {
        throw new Error('Path contains null bytes');
    }

    const fullPath = resolve(rootDir, userPath);

    if (!isAbsolute(fullPath) || !fullPath.startsWith(rootDir + sep)) {
        throw new Error('Path escapes the root directory');
    }

    return fullPath;
}
