import { Transform } from 'node:stream';

function createNdjsonBatchStream({ maxBatchSize, onInvalidLine }: { maxBatchSize: number; onInvalidLine: (rawLine: string, lineNumber: number) => void }): Transform {
    if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1) {
        throw new RangeError('maxBatchSize must be a positive integer');
    }

    let buffer = '';
    let lineNumber = 1;

    return new Transform({
        readableObjectMode: true,
        transform(chunk, encoding, callback) {
            buffer += chunk.toString('utf-8');

            while (buffer.includes('\n')) {
                const lineIndex = buffer.indexOf('\n');
                const line = buffer.slice(0, lineIndex + 1).trim();
                buffer = buffer.slice(lineIndex + 1);

                if (line) {
                    try {
                        const parsedLine = JSON.parse(line);
                        this.push(parsedLine);
                    } catch (error) {
                        onInvalidLine(line, lineNumber);
                    }
                }
                lineNumber++;
            }

            callback();
        },
        flush(callback) {
            if (buffer) {
                const lines = buffer.split('\n');
                lines.forEach(line => {
                    line = line.trim();
                    if (line) {
                        try {
                            const parsedLine = JSON.parse(line);
                            this.push(parsedLine);
                        } catch (error) {
                            onInvalidLine(line, lineNumber);
                        }
                    }
                    lineNumber++;
                });
            }
            callback();
        }
    });
}

export { createNdjsonBatchStream };
