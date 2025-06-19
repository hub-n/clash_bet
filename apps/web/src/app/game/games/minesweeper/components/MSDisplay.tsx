"use client";

import { CellState } from "../MinesweeperGame";
import styles from "./MSDisplay.module.css";
import { GameSessionDetails } from "../../../[gameId]/page";

interface MSDisplayProps {
  field: CellState[][];
  timeLeft: number;
  score: number;
  gameOver: boolean;
  handleClick: (x: number, y: number) => void;
  handleRightClick: (e: React.MouseEvent, x: number, y: number) => void;
  statusMessage?: string;
  opponentStatus?: string | null;
  matchResult?: any;
  myPlayerId?: string | null;
  initialData: GameSessionDetails | null;
}

export default function MSDisplay({
  field,
  timeLeft,
  score,
  gameOver,
  handleClick,
  handleRightClick,
  statusMessage,
  opponentStatus,
  matchResult,
  myPlayerId,
  initialData,
}: MSDisplayProps) {
  const getPlayerResult = (
    playerId: string | null | undefined,
    results: any
  ) => {
    if (!playerId) return null;
    if (String(results.player1Results.id) === playerId)
      return results.player1Results;
    if (String(results.player2Results.id) === playerId)
      return results.player2Results;
    return null;
  };

  const getOpponentResult = (
    playerId: string | null | undefined,
    results: any
  ) => {
    if (!playerId) return null;
    if (String(results.player1Results.id) !== playerId)
      return results.player1Results;
    if (String(results.player2Results.id) !== playerId)
      return results.player2Results;
    return null;
  };

  const myResult = matchResult
    ? getPlayerResult(myPlayerId, matchResult)
    : null;
  const opponentResult = matchResult
    ? getOpponentResult(myPlayerId, matchResult)
    : null;

  return (
    <div className={styles.container}>
      <div className={styles.gameInfo}>
        <div className={styles.timer}>Time left: {timeLeft}s</div>
        <div className={styles.score}>Score: {score}</div>
      </div>
      {statusMessage && (
        <div className={styles.statusMessage}>{statusMessage}</div>
      )}
      {opponentStatus && !matchResult && (
        <div className={styles.opponentStatus}>{opponentStatus}</div>
      )}

      <div className={styles.grid}>
        {field.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className={`${styles.cell} ${
                cell.isRevealed ? styles.revealed : ""
              }`}
              onClick={() => handleClick(x, y)}
              onContextMenu={(e) => handleRightClick(e, x, y)}
            >
              {cell.isFlagged && "🚩"}
              {cell.isRevealed && cell.hasBomb && "💣"}
              {cell.isRevealed &&
                !cell.hasBomb &&
                cell.adjacentBombs > 0 &&
                cell.adjacentBombs}
            </div>
          ))
        )}
      </div>

      {gameOver && !matchResult && timeLeft > 0 && (
        <div className={styles.gameOver}>
          Your game is over! Waiting for opponent...
        </div>
      )}
      {timeLeft <= 0 && !gameOver && !matchResult && (
        <div className={styles.gameOver}>Time’s up! Waiting for results...</div>
      )}

      {matchResult && (
        <div className={styles.matchResult}>
          <h2>{matchResult.winnerId == myPlayerId ? "You won!" : "You lost"}</h2>
          <p>{matchResult.reason}</p>
          {myResult && (
            <p>
              Your Score: {myResult.score} (
              {myResult.timeTakenSeconds.toFixed(1)}s)
            </p>
          )}
          {opponentResult && (
            <p>
              Opponent ({opponentResult.name}) Score: {opponentResult.score} (
              {opponentResult.timeTakenSeconds.toFixed(1)}s)
            </p>
          )}
          <p>
            <em>{matchResult.finalScoreString}</em>
          </p>
        </div>
      )}
    </div>
  );
}
