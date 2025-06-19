import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transactions.entity';
import { UsersService } from 'src/users/users.service';
import {
  CreateTransactionPayload,
  TransactionTypeEnum,
} from './transactions.interface';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly usersService: UsersService,
  ) {}

  private validateCreateTransactionPayload(
    payload: CreateTransactionPayload,
  ): void {
    const isTypeValid = Object.values(TransactionTypeEnum).includes(
      payload.transactionType,
    );

    if (typeof payload.amount !== 'number' || payload.amount <= 0) {
      throw new BadRequestException(
        'Invalid amount. Amount must be a positive number.',
      );
    }
    if (payload.amount > 99999999.99) {
      throw new BadRequestException('Amount is too large.');
    }
    const decimalPart = (payload.amount.toString().split('.')[1] || '').length;
    if (decimalPart > 2) {
      throw new BadRequestException(
        'Amount cannot have more than two decimal places.',
      );
    }

    if (!payload.transactionType || !isTypeValid) {
      throw new BadRequestException('Invalid transaction type.');
    }
    if (
      payload.remarks &&
      (typeof payload.remarks !== 'string' || payload.remarks.length > 400)
    ) {
      throw new BadRequestException(
        'Remarks must be a string and not exceed 400 characters.',
      );
    }
  }

  async createTransaction(
    userId: number,
    payload: CreateTransactionPayload,
  ): Promise<Transaction> {
    this.validateCreateTransactionPayload(payload);

    const user = await this.usersService.findByID(userId);
    if (!user) {
      this.logger.warn(
        `Attempt to create transaction for non-existent User ID: ${userId}`,
      );
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const { amount, transactionType, remarks } = payload;

    const newTransaction = this.transactionRepository.create({
      UserID: userId,
      Amount: amount,
      TransactionType: transactionType,
      Status: 'COMPLETED',
      TransactionTimestamp: new Date(),
      Remarks: remarks || `${transactionType} of ${amount}`,
    });

    try {
      const savedTransaction =
        await this.transactionRepository.save(newTransaction);
      this.logger.log(
        `Transaction ${savedTransaction.TransactionID} created for User ${userId}`,
      );
      return savedTransaction;
    } catch (error) {
      this.logger.error(
        `Failed to create transaction for User ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not record the transaction.',
      );
    }
  }

  async findAllByUserId(userId: number): Promise<Transaction[]> {
    const user = await this.usersService.findByID(userId);
    if (!user) {
      this.logger.warn(
        `Attempt to find transactions for non-existent User ID: ${userId}`,
      );
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }
    return this.transactionRepository.find({
      where: { UserID: userId },
      order: { TransactionTimestamp: 'DESC' },
    });
  }
}
