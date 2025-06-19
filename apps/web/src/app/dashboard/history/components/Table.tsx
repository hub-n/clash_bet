"use client";
import styles from "./Table.module.css";

interface Record {
  datetime: string;
  gameType: string;
  opponent: string;
  result: string;
  betAmount: number;
}

interface TableProps {
  data: Record[];
  loading: boolean;
}

export default function Table({ data, loading }: TableProps) {
  return (
    <div className={styles.table}>
      <div className={styles.header}>
        <span>Date</span>
        <span>Game</span>
        <span>Opponent</span>
        <span>Result</span>
        <span>Bet</span>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading records...</div>
      ) : data.length === 0 ? (
        <div className={styles.row}>No records available.</div>
      ) : (
        data.map((record, index) => (
          <div className={styles.row} key={index}>
            <span>{record.datetime}</span>
            <span>{record.gameType}</span>
            <span>{record.opponent}</span>
            <span>{record.result}</span>
            <span>{record.betAmount}</span>
          </div>
        ))
      )}
    </div>
  );
}
