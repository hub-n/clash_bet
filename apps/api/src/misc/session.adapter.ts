// src/common/adapters/ws-adapter.ts
import { INestApplicationContext } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Server } from 'ws';
import * as passport from 'passport';
import * as cookieParser from 'cookie-parser';
import { Session } from 'express-session';

export class SessionAwareWsAdapter extends WsAdapter {
  constructor(
    private app: INestApplicationContext,
    private sessionMiddleware,
  ) {
    super(app);
  }

  create(port: number, options: any = {}): Server {
    const server = super.create(port, options);

    server.on('headers', (headers, req) => {
      // Optional: Add headers for debugging
    });

    server.on('connection', (socket, request) => {
      // Now request.session and request.user are available
    });

    return server;
  }

  bindClientConnect(server: Server, callback: Function) {
    const sessionMiddleware = this.sessionMiddleware;

    server.on('connection', (client: any, request: any) => {
      cookieParser()(request, {} as any, () => {
        sessionMiddleware(request, {} as any, () => {
          passport.initialize()(request, {} as any, () => {
            passport.session()(request, {} as any, () => {
              if (request.session && request.user) {
                callback(client, request);
              } else {
                client.close();
              }
            });
          });
        });
      });
    });
  }
}
