import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket as WsSocket } from 'ws';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  path: '/api/matchmaking/ws',
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class MatchmakingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('MatchmakingGateway');
  private clients: Map<number, WsSocket> = new Map();

  async handleConnection(client: WsSocket, ...args: any[]) {
    const request = args[0];

    this.logger.log(`[Gateway] WS Upgrade - Path: ${request.url}`);
    this.logger.log(
      `[Gateway] WS Upgrade - Headers: ${JSON.stringify(request.headers, null, 2)}`,
    );
    this.logger.log(
      `[Gateway] WS Upgrade - SessionID from request: ${request.sessionID}`,
    );
    this.logger.log(
      `[Gateway] WS Upgrade - Session object from request: ${JSON.stringify(request.session, null, 2)}`,
    );
    this.logger.log(
      `[Gateway] WS Upgrade - User object (after Passport): ${JSON.stringify(request.user, null, 2)}`,
    );

    const userId = request.user?.UserID;
    const username = request.user?.Username;

    this.logger.log(
      `[Gateway] handleConnection processing for: ${username}#${userId} {${request.user}}`,
    );

    if (userId) {
      this.clients.set(userId, client);
      this.logger.log(
        `[Gateway] Client connected and authenticated: UserID ${userId}, Username: ${username}. Total clients: ${this.clients.size}`,
      );

      client.on('close', (code, reason) => {
        this.logger.log(
          `[Gateway] Client UserID ${userId} disconnected with code: ${code}, reason: ${reason?.toString()}`,
        );
        this.performDisconnect(userId);
      });
    } else {
      this.logger.warn(
        '[Gateway] Client connected without UserID (unauthenticated) or UserID was falsy. Closing connection.',
      );
      client.close(1008, 'User not authenticated');
    }
  }

  handleDisconnect(client: WsSocket) {
    let userIdToRemove: number | null = null;
    for (const [uid, storedClient] of this.clients.entries()) {
      if (storedClient === client) {
        userIdToRemove = uid;
        break;
      }
    }
    if (userIdToRemove) {
      this.logger.log(
        `[Gateway] handleDisconnect called for already known client: UserID ${userIdToRemove}. Performing disconnect.`,
      );
      this.performDisconnect(userIdToRemove);
    } else {
      this.logger.log(
        '[Gateway] handleDisconnect: A client disconnected (was not in tracked clients or already removed by server).',
      );
    }
  }

  private performDisconnect(userId: number) {
    if (this.clients.has(userId)) {
      this.clients.delete(userId);
      this.logger.log(
        `[Gateway] performDisconnect: Client removed for UserID ${userId}. Total clients: ${this.clients.size}`,
      );
    } else {
      this.logger.log(
        `[Gateway] performDisconnect: Attempted to remove UserID ${userId}, but not found in clients map.`,
      );
    }
  }

  sendToUser(userId: number, eventName: string, data: any) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WsSocket.OPEN) {
      try {
        client.send(JSON.stringify({ event: eventName, data }));
        this.logger.log(
          `[Gateway] Sent event '${eventName}' to UserID ${userId}`,
        );
      } catch (error) {
        this.logger.error(
          `[Gateway] Error sending message to UserID ${userId}:`,
          error,
        );
      }
    } else {
      this.logger.warn(
        `[Gateway] Could not send event '${eventName}' to UserID ${userId}: Client not found or connection not open.`,
      );
    }
  }
}
