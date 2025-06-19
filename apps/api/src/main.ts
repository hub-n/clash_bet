import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as passport from 'passport';
import * as cookieParser from 'cookie-parser';
import { SessionAwareWsAdapter } from './misc/session.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const sessionMiddleware = session({
    secret: 'a-very-basic-secret-for-debugging',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 86400000 },
  });

  app.use(cookieParser());
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  app.useWebSocketAdapter(new SessionAwareWsAdapter(app, sessionMiddleware));

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(process.env.PORT || 3001);
  console.log(`App running at ${await app.getUrl()}`);
}
bootstrap();
