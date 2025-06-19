"use client";
import styles from "./Table.module.css";

interface LeaderboardEntry {
  rank: number;
  wins: number;
  username: string;
  winRatio: number;
  matchesCount: number;
}

interface LeaderboardProps {
  data: LeaderboardEntry[];
}

export default function LeaderboardTable({ data }: LeaderboardProps) {
  return (
    <div className={styles.leaderboardTable}>
      <div className={styles.leaderboardHeader}>
        <span>Rank</span>
        <span>Username</span>
        <span>Win Ratio</span>
        <span>Wins</span>
        <span>Matches</span>
      </div>
      <div className={styles.leaderboardContent}>
        {data.map((entry) => (
          <div key={entry.rank} className={styles.leaderboardRow}>
            <span>{entry.rank}</span>
            <span>{entry.username}</span>
            <span>{entry.winRatio.toFixed(2)}%</span>
            <span>{entry.wins}</span>
            <span>{entry.matchesCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
