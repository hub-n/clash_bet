import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { CreateTransactionPayload } from './transactions.interface';
import { Transaction } from './transactions.entity';

@Controller('transactions')
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @UseGuards(AuthenticatedGuard)
  @Post('create')
  async create(
    @Body() payload: CreateTransactionPayload,
    @Req() req: any,
  ): Promise<Transaction> {
    const userId = req.user?.UserID;

    if (!userId) {
      this.logger.error(
        'User ID not found in request during transaction creation.',
      );
      throw new UnauthorizedException('User authentication data not found.');
    }

    if (
      !payload ||
      typeof payload.amount !== 'number' ||
      !payload.transactionType
    ) {
      this.logger.warn(
        `Invalid payload structure received for transaction creation by User ${userId}: ${JSON.stringify(payload)}`,
      );
      throw new BadRequestException(
        'Invalid payload structure. Amount and transactionType are required.',
      );
    }

    this.logger.log(
      `User ${userId} creating transaction: ${JSON.stringify(payload)}`,
    );
    return this.transactionsService.createTransaction(userId, payload);
  }

  @UseGuards(AuthenticatedGuard)
  @Get('find')
  async findAllForUser(@Req() req: any): Promise<Transaction[]> {
    const userId = req.user?.UserID;
    if (!userId) {
      this.logger.error(
        'User ID not found in request when fetching transactions.',
      );
      throw new UnauthorizedException('User authentication data not found.');
    }
    return this.transactionsService.findAllByUserId(userId);
  }
}
