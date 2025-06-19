import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceState } from './balance-state.entity';
import { BalanceStatesService } from './balance-state.service';
import { BalanceStatesController } from './balance-state.controller';
@Module({
  imports: [TypeOrmModule.forFeature([BalanceState])],
  providers: [BalanceStatesService],
  controllers: [BalanceStatesController],
})
export class BalanceStatesModule {}
