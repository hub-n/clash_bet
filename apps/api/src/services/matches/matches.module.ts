import { Module, forwardRef } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { UsersModule } from 'src/users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './matches.entity';
import { PlayerStatsModule } from 'src/users/player-stats/player-stats.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => MatchmakingModule),
    TypeOrmModule.forFeature([Match]),
    forwardRef(() => PlayerStatsModule),
  ],
  providers: [MatchesService],
  controllers: [MatchesController],
  exports: [MatchesService],
})
export class MatchesModule {}
