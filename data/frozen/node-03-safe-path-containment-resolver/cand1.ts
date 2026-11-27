import { resolve, dirname } from 'path';

export function resolveInsideRoot(rootDir: string, userPath: string): string {
    if (userPath.includes('\0')) {
        throw new Error('Path contains null byte');
    }

    const fullPath = resolve(rootDir, userPath);
    if (!fullPath.startsWith(resolve(rootDir))) {
        throw new Error('Path escapes root directory');
    }

    return fullPath;
}
