import type { Response } from 'express';

/** Connected Server-Sent Events clients (the app keeps one open per phone), with their user. */
const clients = new Map<Response, string>();

export function addClient(res: Response, userId: string) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  clients.set(res, userId);
  // Comment lines keep proxies and phones from closing an idle stream.
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  res.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

/** Sends an event to every phone the user has open. */
export function sendToUser(userId: string, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [res, owner] of clients) if (owner === userId) res.write(payload);
}

export const clientCount = () => clients.size;
