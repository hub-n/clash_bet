export enum TransactionTypeEnum {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export interface CreateTransactionPayload {
  amount: number;
  transactionType: TransactionTypeEnum;
  remarks?: string;
}
