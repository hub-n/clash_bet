import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingController } from './matchmaking.controller';
import { MatchesModule } from '../matches.module';
import { MatchmakingGateway } from '../sockets/matchmaking.gateway';
import { RpsGateway } from 'src/services/games/sockets/rps.gateway';
import { MinesweeperGateway } from 'src/services/games/sockets/minesweeper.gateway';

@Module({
  imports: [forwardRef(() => UsersModule), forwardRef(() => MatchesModule)],
  providers: [
    MatchmakingService,
    MatchmakingGateway,
    RpsGateway,
    MinesweeperGateway,
  ],
  controllers: [MatchmakingController],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
