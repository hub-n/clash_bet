import {
  Controller,
  Get,
  UseGuards,
  Req,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import {
  BalanceStatesService,
  FormattedBalanceDataPoint,
} from './balance-state.service';

@Controller('balance-states')
export class BalanceStatesController {
  private readonly logger = new Logger(BalanceStatesController.name);

  constructor(private readonly balanceStatesService: BalanceStatesService) {}

  @UseGuards(AuthenticatedGuard)
  @Get('history')
  async getUserBalanceHistory(
    @Req() req: any,
  ): Promise<FormattedBalanceDataPoint[]> {
    const userId = req.user?.UserID;

    if (!userId) {
      this.logger.error('User ID not found in request for balance history.');
      throw new UnauthorizedException('User authentication data not found.');
    }
    return this.balanceStatesService.findByUserIdForGraph(userId);
  }
}
