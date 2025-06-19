"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import styles from "./wallet.module.css";
import PaymentSelection from "./components/PaymentSelection";
import TransactionForm from "./components/TransactionForm";
import TransactionAmountInput from "./components/TransactionAmountInput";
import type {
  PaymentMethod,
  SavedCard,
  SavedBankAccount,
  SelectedMethodSummary,
} from "./types";
import { useRouter } from "next/navigation";

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.");
    try {
      const errorInfo = await res.json();
      (error as any).info = errorInfo;
    } catch (e) {
      //
    }
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

const formatCurrency = (value: number, locale: string = "en-US") => {
  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `💎 ${formattedNumber}`;
};

const initialSavedCardsData: SavedCard[] = [
  { id: "card_1", type: "visa", last4: "4242", expiry: "12/25" },
  { id: "card_2", type: "mastercard", last4: "5555", expiry: "06/26" },
];
const initialSavedBankAccountsData: SavedBankAccount[] = [
  { id: "bank_1", name: "Checking", last4: "1111", bankName: "My Bank" },
  { id: "bank_2", name: "Savings", last4: "9876", bankName: "Another Bank" },
];
const initialAccountBalanceData = 0;

const getMethodDisplayString = (
  method: PaymentMethod,
  actionType: "deposit" | "withdraw"
): string => {
  if (actionType === "deposit" && "type" in method && "expiry" in method) {
    return `${method.type.toUpperCase()} ending in ${method.last4} (Exp: ${
      method.expiry
    })`;
  } else if (
    actionType === "withdraw" &&
    "bankName" in method &&
    "name" in method
  ) {
    return `${method.bankName} - ${method.name} ending in ${method.last4}`;
  }
  return `Account ending in ${method.last4}`;
};

const recordTransaction = async (
  amount: number,
  type: "DEPOSIT" | "WITHDRAWAL",
  remarks?: string
) => {
  try {
    const response = await fetch("/api/transactions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        amount: amount,
        transactionType: type,
        remarks: remarks || `${type} via web wallet`,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Failed to record transaction: ${response.status} ${errorBody}`
      );
    } else {
      console.log("Transaction recorded successfully");
      const recordedTx = await response.json();
      console.log("Recorded Transaction:", recordedTx);
    }
  } catch (error) {
    console.error("Error recording transaction:", error);
  }
};

export default function WalletPage() {
  const router = useRouter();
  const [authCheckLoading, setAuthCheckLoading] = useState(true);

  const {
    data: balanceSWRData,
    error: balanceSWRError,
    isLoading: isBalanceLoading,
    mutate: mutateBalanceCache,
  } = useSWR<{ balance: number }>(
    authCheckLoading ? null : "/api/user/balance",
    fetcher
  );

  const accountBalance = balanceSWRData?.balance ?? initialAccountBalanceData;

  const [savedCards, setSavedCards] = useState<SavedCard[]>(
    initialSavedCardsData
  );
  const [savedBankAccounts, setSavedBankAccounts] = useState<
    SavedBankAccount[]
  >(initialSavedBankAccountsData);
  const [activeAction, setActiveAction] = useState<
    "deposit" | "withdraw" | null
  >(null);
  const [currentView, setCurrentView] = useState<
    "selectMethod" | "addMethod" | "enterAmount" | null
  >(null);
  const [selectedMethodForTransaction, setSelectedMethodForTransaction] =
    useState<SelectedMethodSummary | null>(null);

  useEffect(() => {
    const performAuthCheck = async () => {
      setAuthCheckLoading(true);
      try {
        const authRes = await fetch("/api/auth/session", {
          credentials: "include",
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (!authData?.authenticated) {
            router.replace("/");
            return;
          }
        } else {
          router.replace("/");
          return;
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        router.replace("/");
        return;
      }
      setAuthCheckLoading(false);
    };
    performAuthCheck();
  }, [router]);

  const handleInitiateDeposit = () => {
    setActiveAction("deposit");
    setCurrentView("selectMethod");
    setSelectedMethodForTransaction(null);
  };
  const handleInitiateWithdraw = () => {
    setActiveAction("withdraw");
    setCurrentView("selectMethod");
    setSelectedMethodForTransaction(null);
  };
  const handleCloseFlow = () => {
    setActiveAction(null);
    setCurrentView(null);
    setSelectedMethodForTransaction(null);
  };
  const handleMethodSelected = (method: PaymentMethod) => {
    if (!activeAction) return;
    setSelectedMethodForTransaction({
      id: method.id,
      display: getMethodDisplayString(method, activeAction),
    });
    setCurrentView("enterAmount");
  };
  const handleAddNewMethodClicked = () => {
    setCurrentView("addMethod");
  };
  const handleNewMethodSaved = (newMethodDetails: { [key: string]: any }) => {
    if (!activeAction) return;
    let newMethodFull: PaymentMethod;
    if (activeAction === "deposit") {
      const newCard: SavedCard = {
        id: `card_${Date.now()}`,
        type: newMethodDetails.cardType || "new-card",
        last4: newMethodDetails.cardNumber.slice(-4),
        expiry: newMethodDetails.expiryDate,
      };
      newMethodFull = newCard;
      setSavedCards((prev) => [...prev, newCard]);
    } else {
      const newBank: SavedBankAccount = {
        id: `bank_${Date.now()}`,
        name: newMethodDetails.accountName || "New Account",
        last4: newMethodDetails.accountNumber.slice(-4),
        bankName: newMethodDetails.bankIdentifier || "New Bank",
      };
      newMethodFull = newBank;
      setSavedBankAccounts((prev) => [...prev, newBank]);
    }
    setSelectedMethodForTransaction({
      id: newMethodFull.id,
      display: getMethodDisplayString(newMethodFull, activeAction),
    });
    setCurrentView("enterAmount");
  };

  const handleAmountSubmit = async (amount: number, methodId: string) => {
    if (activeAction === "withdraw" && amount > accountBalance) {
      alert("Insufficient funds for withdrawal.");
      return;
    }
    try {
      const calculatedNewBalance =
        activeAction === "deposit"
          ? accountBalance + amount
          : accountBalance - amount;

      const balanceResponse = await fetch("/api/user/update-balance", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          newBalance: calculatedNewBalance,
        }),
      });

      if (!balanceResponse.ok) {
        const errorBody = await balanceResponse.text();
        throw new Error(
          `Failed to update balance: ${balanceResponse.status} ${errorBody}`
        );
      }

      const result = await balanceResponse.json();
      const newBalanceFromServer = result.wallet.Balance;

      mutateBalanceCache(
        { balance: newBalanceFromServer },
        { revalidate: false }
      );

      window.dispatchEvent(
        new CustomEvent("dashboard-balance-update", {
          detail: { balance: newBalanceFromServer },
        })
      );

      if (activeAction) {
        let transactionTypeForApi: "DEPOSIT" | "WITHDRAWAL";
        if (activeAction === "deposit") {
          transactionTypeForApi = "DEPOSIT";
        } else if (activeAction === "withdraw") {
          transactionTypeForApi = "WITHDRAWAL";
        } else {
          console.error("Unknown activeAction:", activeAction);
          // Optionally, decide if you want to proceed or show an error
          return;
        }
        await recordTransaction(
          amount,
          transactionTypeForApi,
          `Transaction via ${selectedMethodForTransaction?.display || "Wallet"}`
        );
      }

      alert(
        `${activeAction?.toUpperCase()} of ${formatCurrency(amount)} completed!`
      );
      handleCloseFlow();
    } catch (error) {
      console.error(error);
      alert(
        `Transaction failed. ${
          error instanceof Error ? error.message : "Please try again."
        }`
      );
    }
  };

  const goBackToMethodSelection = () => {
    setCurrentView("selectMethod");
    setSelectedMethodForTransaction(null);
  };

  const renderActionComponent = () => {
    if (!activeAction || !currentView) return null;
    switch (currentView) {
      case "selectMethod":
        return (
          <PaymentSelection
            actionType={activeAction}
            savedMethods={
              activeAction === "deposit" ? savedCards : savedBankAccounts
            }
            onSelectMethod={handleMethodSelected}
            onAddNew={handleAddNewMethodClicked}
            onClose={handleCloseFlow}
          />
        );
      case "addMethod":
        return (
          <TransactionForm
            formType={activeAction}
            onSubmit={handleNewMethodSaved}
            onClose={goBackToMethodSelection}
          />
        );
      case "enterAmount":
        if (!selectedMethodForTransaction) {
          goBackToMethodSelection();
          return <p>Error: No payment method selected. Please go back.</p>;
        }
        return (
          <TransactionAmountInput
            actionType={activeAction}
            selectedMethod={selectedMethodForTransaction}
            currentBalance={
              activeAction === "withdraw" ? accountBalance : undefined
            }
            onSubmit={handleAmountSubmit}
            onBack={goBackToMethodSelection}
            onClose={handleCloseFlow}
          />
        );
      default:
        return null;
    }
  };

  const renderBalanceDisplay = () => {
    if (authCheckLoading) return "Authenticating...";
    if (isBalanceLoading && !balanceSWRData) return "Fetching balance...";
    if (balanceSWRError) {
      console.error("Balance SWR Error:", balanceSWRError);
      return "Error loading balance";
    }
    return formatCurrency(accountBalance);
  };

  if (authCheckLoading && !balanceSWRData) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className={styles.walletContainer}>
      <h1 className={styles.pageTitle}>Your Wallet</h1>
      <div className={styles.balanceSection}>
        <p className={styles.balanceLabel}>Current Balance</p>
        <p className={styles.balanceAmount}>{renderBalanceDisplay()}</p>
      </div>
      {!activeAction && (
        <div className={styles.actionsContainer}>
          <button
            className={`${styles.actionButton} ${styles.depositButton}`}
            onClick={handleInitiateDeposit}
          >
            Deposit Funds
          </button>
          <button
            className={`${styles.actionButton} ${styles.withdrawButton}`}
            onClick={handleInitiateWithdraw}
            disabled={accountBalance <= 0 && !isBalanceLoading}
          >
            Withdraw Funds
          </button>
        </div>
      )}
      {renderActionComponent()}
    </div>
  );
}
