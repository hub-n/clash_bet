import { Module, forwardRef } from '@nestjs/common';
import { User } from './users.entity';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { PlayerStatsModule } from './player-stats/player-stats.module';
import { WalletsModule } from './wallets/wallets.module';
import { Wallets } from './wallets/wallets.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([Wallets]),
    forwardRef(() => PlayerStatsModule),
    WalletsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
