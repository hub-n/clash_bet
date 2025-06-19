import { Module, forwardRef } from '@nestjs/common';
import { PlayerStatsService } from './player-stats.service';
import { PlayerStatsController } from './player-stats.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerStatistics } from './player-stats.entity';
import { MatchesModule } from 'src/services/matches/matches.module';
import { UsersModule } from '../users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlayerStatistics]),
    forwardRef(() => MatchesModule),
    forwardRef(() => UsersModule),
  ],
  providers: [PlayerStatsService],
  controllers: [PlayerStatsController],
  exports: [PlayerStatsService],
})
export class PlayerStatsModule {}
