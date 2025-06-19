import 'http';
import { Session, SessionData } from 'express-session';

declare module 'http' {
  interface IncomingMessage {
    session?: Session & Partial<SessionData>;
    sessionID?: string;
    user?: any;
  }
}
