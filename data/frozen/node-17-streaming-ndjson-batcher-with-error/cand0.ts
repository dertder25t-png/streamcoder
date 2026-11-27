import { Transform, TransformCallback } from 'stream';

function createNdjsonBatchStream({ maxBatchSize, onInvalidLine }: { maxBatchSize: number; onInvalidLine: (rawLine: string, lineNumber: number) => void }): Transform {
    if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1) {
        throw new RangeError('maxBatchSize must be a positive integer');
    }

    let buffer = '';
    let lineNumber = 1;

    return new Transform({
        readableObjectMode: true,
        transform(chunk, encoding, callback: TransformCallback) {
            buffer += chunk.toString('utf-8');

            while (buffer.includes('\n')) {
                const newlineIndex = buffer.indexOf('\n');
                const line = buffer.slice(0, newlineIndex).trim();

                if (line) {
                    try {
                        const parsedLine = JSON.parse(line);
                        this.push(parsedLine);
                    } catch (error) {
                        onInvalidLine(line, lineNumber);
                    }
                }

                buffer = buffer.slice(newlineIndex + 1);
                lineNumber++;
            }

            callback();
        },
        flush(callback: TransformCallback) {
            if (buffer) {
                const lines = buffer.split('\n');
                lines.forEach((line, index) => {
                    line = line.trim();
                    if (line) {
                        try {
                            const parsedLine = JSON.parse(line);
                            this.push(parsedLine);
                        } catch (error) {
                            onInvalidLine(line, lineNumber + index);
                        }
                    }
                });
            }
            callback();
        }
    });
}

export { createNdjsonBatchStream };
