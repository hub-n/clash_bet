import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import datasource from './users/datasource';
import { AuthModule } from './services/auth/auth.module';
import { MatchmakingModule } from './services/matches/matchmaking/matchmaking.module';
import { MatchesModule } from './services/matches/matches.module';
import { BalanceStatesModule } from './services/balance-state/balance-state.module';
import { TransactionsModule } from './services/transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...datasource.options,
      autoLoadEntities: true,
    }),
    UsersModule,
    AuthModule,
    MatchesModule,
    MatchmakingModule,
    BalanceStatesModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
