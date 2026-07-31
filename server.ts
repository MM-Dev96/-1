import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import {
  JOB_EVENT_CHANNEL,
  JOB_SNAPSHOT_CHANNEL,
  JOB_SUBSCRIBE_CHANNEL,
} from './src/shared/contracts.ts';
import { createApp } from './src/server/app.ts';
import { JobManager } from './src/server/jobManager.ts';
import { PreviewStore } from './src/server/previewStore.ts';

export interface RunningServer {
  close: () => Promise<void>;
  port: number;
}

export async function startServer(port = Number(process.env.PORT) || 3000): Promise<RunningServer> {
  const rootApp = express();
  const httpServer = http.createServer(rootApp);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 60_000,
  });
  const jobManager = new JobManager((room, event) => {
    io.to(room).emit(JOB_EVENT_CHANNEL, event);
  });
  const previewStore = new PreviewStore();
  rootApp.use(createApp({ jobManager, previewStore }));

  io.on('connection', (socket) => {
    socket.on(JOB_SUBSCRIBE_CHANNEL, (jobId: unknown) => {
      if (typeof jobId !== 'string' || !jobId) return;
      socket.join(`job:${jobId}`);
      const snapshot = jobManager.get(jobId);
      if (snapshot) socket.emit(JOB_SNAPSHOT_CHANNEL, snapshot);
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    rootApp.use(express.static(distDir));
    rootApp.get('*', (_request, response) => {
      response.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    rootApp.use(vite.middlewares);
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '0.0.0.0', resolve);
  });
  const address = httpServer.address();
  const resolvedPort =
    address && typeof address === 'object' ? address.port : port;
  console.info(`NexusSaaS running on http://localhost:${resolvedPort}`);

  return {
    port: resolvedPort,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        io.close();
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
