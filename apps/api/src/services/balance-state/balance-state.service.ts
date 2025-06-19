import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceState } from './balance-state.entity';

export interface FormattedBalanceDataPoint {
  datetime: string;
  balance: number;
}

@Injectable()
export class BalanceStatesService {
  private readonly logger = new Logger(BalanceStatesService.name);

  constructor(
    @InjectRepository(BalanceState)
    private readonly balanceStateRepository: Repository<BalanceState>,
  ) {}

  async findByUserIdForGraph(
    userId: number,
  ): Promise<FormattedBalanceDataPoint[]> {
    this.logger.log(`Fetching balance state history for UserID: ${userId}`);
    const balanceStates = await this.balanceStateRepository.find({
      where: { UserID: userId },
      order: { BalanceStateTimestamp: 'ASC' },
    });

    if (!balanceStates || balanceStates.length === 0) {
      return [];
    }

    return balanceStates.map((state) => ({
      datetime: state.BalanceStateTimestamp.toISOString(),
      balance: state.FinalBalance,
    }));
  }
}
