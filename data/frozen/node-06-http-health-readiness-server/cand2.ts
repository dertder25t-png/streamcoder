import http from 'node:http';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

export function createHealthServer(checkReady: () => Promise<boolean>): http.Server {
    return createServer((req: IncomingMessage, res: ServerResponse) => {
        const { method, url } = req;

        if (method === 'GET') {
            if (url === '/live') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            } else if (url === '/ready') {
                checkReady()
                    .then(ready => {
                        if (ready) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                        } else {
                            res.writeHead(503, { 'Content-Type': 'application/json' });
                        }
                        res.end(JSON.stringify({ status: ready ? 'ok' : 'unavailable' }));
                    })
                    .catch(() => {
                        res.writeHead(503, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'unavailable' }));
                    });
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        } else {
            res.writeHead(405, { 'Allow': 'GET', 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    });
}
