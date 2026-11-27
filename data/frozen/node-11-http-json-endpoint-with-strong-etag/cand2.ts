import { createHash } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';

function createConfigHandler(getConfig: () => unknown): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const ifNoneMatch = req.headers['if-none-match'];
    const config = getConfig();
    const configStr = JSON.stringify(config);
    const etag = createHash('sha256').update(configStr).digest('hex');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('ETag', `"${etag}"`);

    if (ifNoneMatch) {
      const matches = ifNoneMatch.split(',').some(match => match.trim() === '*' || match.trim() === `"${etag}"`);
      if (matches) {
        res.writeHead(304);
        return res.end();
      }
    }

    res.writeHead(200);
    res.end(configStr);
  };
}

export { createConfigHandler };
