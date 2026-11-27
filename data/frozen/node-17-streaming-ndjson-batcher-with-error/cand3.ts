import { Transform } from 'stream';

function createNdjsonBatchStream({ maxBatchSize, onInvalidLine }: { maxBatchSize: number; onInvalidLine: (rawLine: string, lineNumber: number) => void }): Transform {
    if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1) {
        throw new RangeError('maxBatchSize must be a positive integer');
    }

    let buffer = '';
    let lineNumber = 1;
    let currentBatch: string[] = [];

    return new Transform({
        readableObjectMode: true,
        write(chunk, encoding, callback) {
            buffer += chunk.toString('utf-8');

            let pos = 0;
            while (pos < buffer.length) {
                if (buffer[pos] === '\n' || buffer[pos] === '\r') {
                    const line = buffer.slice(0, pos).trim();
                    buffer = buffer.slice(pos + 1);

                    if (line) {
                        try {
                            const parsed = JSON.parse(line);
                            currentBatch.push(parsed);
                            if (currentBatch.length === maxBatchSize) {
                                this.push(currentBatch);
                                currentBatch = [];
                            }
                        } catch {
                            onInvalidLine(line, lineNumber);
                        }
                    }
                    lineNumber++;
                } else {
                    pos++;
                }
            }

            callback();
        },
        final(callback) {
            const remaining = buffer.trim();
            if (remaining) {
                try {
                    const parsed = JSON.parse(remaining);
                    currentBatch.push(parsed);
                } catch {
                    onInvalidLine(remaining, lineNumber);
                }
            }
            if (currentBatch.length > 0) {
                this.push(currentBatch);
            }
            callback();
        }
    });
}

export { createNdjsonBatchStream };
