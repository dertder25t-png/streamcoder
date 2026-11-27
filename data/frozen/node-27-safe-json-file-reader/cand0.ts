import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export async function readJsonSafe<T>(filePath: string, fallback: T): Promise<T> {
    try {
        const fullPath = path.resolve(filePath);
        const data = await fs.readFile(fullPath, 'utf8');
        return JSON.parse(data) as T;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return fallback;
        } else if (error instanceof SyntaxError) {
            return fallback;
        }
        throw error;
    }
}
