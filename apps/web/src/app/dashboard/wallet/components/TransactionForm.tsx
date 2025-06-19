"use client";

import React, { useState } from 'react';
import styles from './TransactionForm.module.css';

interface TransactionFormProps {
  formType: 'deposit' | 'withdraw'; // Determines if adding card or bank
  onClose: () => void;
  onSubmit: (details: any) => void;
}

export default function TransactionForm({ formType, onClose, onSubmit }: TransactionFormProps) {
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let details: any = { type: formType }; // Include type for context

    if (formType === 'deposit') {
        if (!cardNumber || !expiryDate || !cvc) {
            setError('Please fill in all credit card details.');
            return;
        }
        details = { ...details, cardNumber, expiryDate, cvc };
        console.log("Saving Card Details:", details);

    } else if (formType === 'withdraw') {
        if (!accountNumber || !routingNumber) {
            setError('Please fill in bank account and routing number.');
            return;
        }
        details = { ...details, accountNumber, routingNumber };
         console.log("Saving Bank Account Details:", details);
    }

    // TODO: Replace console.log with API call to save the payment method
    alert(`Simulating saving new ${formType === 'deposit' ? 'card' : 'bank account'}. Check console.`);
    onSubmit(details);
  };

  const title = formType === 'deposit' ? 'Add New Card' : 'Add New Bank Account';
  const submitText = formType === 'deposit' ? 'Save Card' : 'Save Bank Account';

  return (
    <div className={styles.transactionFormContainer}>
      <h3 className={styles.formTitle}>{title}</h3>
      <form onSubmit={handleSubmit}>
        {formType === 'deposit' && (
          <>
            <p className={styles.formInfo}>Enter Credit Card Details:</p>
             <div className={styles.formGroup}> {/* ... card number ... */}
                <label htmlFor="cardNumber">Card Number</label>
                <input type="text" id="cardNumber" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="•••• •••• •••• ••••" required className={styles.formInput} />
             </div>
             <div className={styles.formRow}> {/* ... expiry / cvc ... */}
                <div className={styles.formGroup}><label htmlFor="expiryDate">Expiry (MM/YY)</label><input type="text" id="expiryDate" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} placeholder="MM/YY" required className={styles.formInput} /></div>
                <div className={styles.formGroup}><label htmlFor="cvc">CVC</label><input type="password" id="cvc" value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="•••" required className={styles.formInput} maxLength={4}/></div>
             </div>
             <p className={styles.securityNotice}><strong>Warning:</strong> For demonstration only. Use secure payment providers.</p>
          </>
        )}

        {formType === 'withdraw' && (
          <>
             <p className={styles.formInfo}>Enter Bank Account Details:</p>
             <div className={styles.formGroup}> {/* ... account number ... */}
                <label htmlFor="accountNumber">Account Number</label><input type="text" id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Your bank account number" required className={styles.formInput}/>
             </div>
             <div className={styles.formGroup}> {/* ... routing number ... */}
                <label htmlFor="routingNumber">Routing Number</label><input type="text" id="routingNumber" value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} placeholder="Your bank routing number" required className={styles.formInput}/>
             </div>
          </>
        )}

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={`${styles.formActionButton} ${styles.submitButton}`}>
            {submitText}
          </button>
          <button type="button" onClick={onClose} className={`${styles.formActionButton} ${styles.cancelButton}`}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}