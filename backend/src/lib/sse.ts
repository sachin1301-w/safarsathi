import type { Response } from 'express';

/** Connected Server-Sent Events clients (the app keeps one open per phone). */
const clients = new Set<Response>();

export function addClient(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  clients.add(res);
  // Comment lines keep proxies and phones from closing an idle stream.
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  res.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

export const clientCount = () => clients.size;
