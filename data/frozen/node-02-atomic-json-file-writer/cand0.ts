import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
    const tempFilePath = join(
        (await fs.realpath(filePath)).replace(/\/[^/]*$/, ''),
        `.${Math.random().toString(36).substring(2, 15)}.tmp`
    );

    try {
        const jsonData = JSON.stringify(data, null, 2) + '\n';
        await fs.writeFile(tempFilePath, jsonData, 'utf8');
        await fs.rename(tempFilePath, filePath);
    } catch (error) {
        // If an error occurs, ensure the temporary file is removed
        if (await fs.exists(tempFilePath)) {
            await fs.unlink(tempFilePath);
        }
        throw error;
    }
}
