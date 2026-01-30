import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ClientMessage, ServerMessage } from '@cloudscode/shared';
import { DEFAULT_WS_PATH } from '@cloudscode/shared';
import { logger } from './logger.js';
import { handleClientMessage } from './ws-handler.js';

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: DEFAULT_WS_PATH });

  wss.on('connection', (ws) => {
    clients.add(ws);
    logger.info({ clients: clients.size }, 'WebSocket client connected');

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        logger.debug({ type: message.type }, 'Received WS message');
        handleClientMessage(ws, message);
      } catch (err) {
        logger.error({ err }, 'Failed to parse WS message');
        sendTo(ws, {
          type: 'chat:error',
          payload: { message: 'Invalid message format' },
        });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info({ clients: clients.size }, 'WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      logger.error({ err }, 'WebSocket error');
      clients.delete(ws);
    });
  });

  return wss;
}

export function broadcast(message: ServerMessage): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function sendTo(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
