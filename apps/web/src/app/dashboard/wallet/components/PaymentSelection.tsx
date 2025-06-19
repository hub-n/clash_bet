"use client";

import React from 'react';
import styles from './PaymentSelection.module.css';


import type { PaymentMethod, SavedCard, SavedBankAccount } from '../types';



interface PaymentSelectionProps {
  actionType: 'deposit' | 'withdraw';
  savedMethods: PaymentMethod[]; // Uses the imported type
  onSelectMethod: (method: PaymentMethod) => void; // Uses the imported type
  onAddNew: () => void;
  onClose: () => void;
}

const getMethodDisplay = (method: PaymentMethod, actionType: 'deposit' | 'withdraw'): string => {
    if (actionType === 'deposit' && 'type' in method && 'expiry' in method) {
        const card = method as SavedCard;
        return `${card.type.toUpperCase()} ending in ${card.last4} (Exp: ${card.expiry})`;
    }
    else if (actionType === 'withdraw' && 'bankName' in method && 'name' in method) {
        const bank = method as SavedBankAccount;
        return `${bank.bankName} - ${bank.name} ending in ${bank.last4}`;
    }
    return `Account ending in ${method.last4}`;
};

export default function PaymentSelection({
  actionType,
  savedMethods,
  onSelectMethod,
  onAddNew,
  onClose,
}: PaymentSelectionProps) {
  const title = actionType === 'deposit' ? 'Select Deposit Method' : 'Select Withdrawal Account';
  const addNewText = actionType === 'deposit' ? 'Add New Card' : 'Add New Bank Account';

  return (
    <div className={styles.selectionContainer}>
      <h3 className={styles.selectionTitle}>{title}</h3>
      {savedMethods.length > 0 ? (
        <ul className={styles.methodList}>
          {savedMethods.map((method) => (
            <li key={method.id} className={styles.methodItem}>
              <button
                onClick={() => onSelectMethod(method)}
                className={styles.methodButton}
              >
                {getMethodDisplay(method, actionType)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.noMethodsText}>No saved methods found.</p>
      )}

      <div className={styles.selectionActions}>
        <button onClick={onAddNew} className={`${styles.actionButton} ${styles.addButton}`}>
          {addNewText}
        </button>
        <button onClick={onClose} className={`${styles.actionButton} ${styles.cancelButton}`}>
          Cancel
        </button>
      </div>
    </div>
  );
}