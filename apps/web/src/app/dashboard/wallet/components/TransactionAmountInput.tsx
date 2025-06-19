"use client";

import React, { useState } from 'react';
import styles from './TransactionAmountInput.module.css';

// Helper function to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

interface PaymentMethodSummary {
  id: string;
  display: string; // e.g., "Visa **** 4242"
}

interface TransactionAmountInputProps {
  actionType: 'deposit' | 'withdraw';
  selectedMethod: PaymentMethodSummary;
  currentBalance?: number; // For withdrawal validation
  onSubmit: (amount: number, methodId: string) => void;
  onBack: () => void;
  onClose: () => void;
}

export default function TransactionAmountInput({
  actionType,
  selectedMethod,
  currentBalance,
  onSubmit,
  onBack,
  onClose,
}: TransactionAmountInputProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (actionType === 'withdraw' && currentBalance !== undefined && numericAmount > currentBalance) {
      setError(`Withdrawal amount cannot exceed your balance of ${formatCurrency(currentBalance)}.`);
      return;
    }

    // TODO: Add more specific validation (min/max deposit/withdrawal if applicable)

    onSubmit(numericAmount, selectedMethod.id);
  };

  const title = actionType === 'deposit' ? 'Enter Deposit Amount' : 'Enter Withdrawal Amount';
  const submitButtonText = actionType === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal';

  return (
    <div className={styles.amountInputContainer}>
      <h3 className={styles.amountInputTitle}>{title}</h3>
      <p className={styles.methodInfo}>
        Using: <strong>{selectedMethod.display}</strong>
      </p>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="transactionAmount" className={styles.amountLabel}>Amount ($)</label>
          <input
            type="number"
            id="transactionAmount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            required
            className={styles.amountInput}
            autoFocus // Focus on amount input
          />
        </div>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={`${styles.actionButton} ${styles.confirmButton}`}>
            {submitButtonText}
          </button>
          <button type="button" onClick={onBack} className={`${styles.actionButton} ${styles.backButton}`}>
            Back
          </button>
          <button type="button" onClick={onClose} className={`${styles.actionButton} ${styles.cancelButton}`}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}