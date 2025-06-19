// app/dashboard/wallet/types.ts

export interface BasePaymentMethod {
    id: string;
    last4: string;
  }

  export interface SavedCard extends BasePaymentMethod {
    type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'new-card' | string; // Allow string for dynamic types
    expiry: string;
  }

  export interface SavedBankAccount extends BasePaymentMethod {
    name: string;
    bankName: string;
  }

  // Export the main union type
  export type PaymentMethod = SavedCard | SavedBankAccount;

  // You can also move other related types here if they are shared
  export interface SelectedMethodSummary {
      id: string;
      display: string;
  }