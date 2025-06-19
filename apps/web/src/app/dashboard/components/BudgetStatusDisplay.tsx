"use client";

import { useEffect } from "react";
import useSWR, { mutate } from "swr";
import styles from "./BudgetStatusDisplay.module.css";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((res) => res.json());

export default function BudgetStatusDisplay() {
  const { data, error } = useSWR<{ balance: number }>(
    "/api/user/balance",
    fetcher
  );

  useEffect(() => {
    const handleBalanceUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent?.detail?.balance !== undefined) {
        mutate(
          "/api/user/balance",
          { balance: customEvent.detail.balance },
          false
        );
      }
    };

    window.addEventListener("dashboard-balance-update", handleBalanceUpdate);
    return () =>
      window.removeEventListener(
        "dashboard-balance-update",
        handleBalanceUpdate
      );
  }, []);

  if (error) return <span className={styles.balanceAmount}>—</span>;
  if (!data) return <span className={styles.balanceAmount}>Loading…</span>;

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(data.balance);

  return (
    <div
      className={styles.budgetStatusPill}
      aria-label={`Current account balance: ${formatted}`}
      title={`Account Balance: ${formatted}`}
    >
      <span className={styles.balanceAmount}>💎 {formatted}</span>
    </div>
  );
}
