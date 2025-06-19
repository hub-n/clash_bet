import styles from "./RPSDisplay.module.css";

const MOVE_EMOJIS: Record<string, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

interface RPSGameState {
  player1Name: string;
  player2Name: string;
  player1Id: string;
  player2Id: string;
  player1Move: string | null; // Current round move
  player2Move: string | null; // Current round move
  overallScore: { player1: number; player2: number }; // BO5 scores
  roundResultText: string | null;
  statusMessage: string;
  isMatchOver: boolean;
  matchWinnerId: string | null; // Store the ID of the BO5 winner
  currentRoundNumber: number;
}

interface RPSDisplayProps {
  gameState: RPSGameState;
  userId: string | null;
}

export default function RPSDisplay({ gameState, userId }: RPSDisplayProps) {
  let matchOverDisplayMessage = "";
  if (gameState.isMatchOver) {
    const userIsWinner = gameState.matchWinnerId && String(gameState.matchWinnerId) == userId;
      if (gameState.matchWinnerId) {
        if (userIsWinner) {
          matchOverDisplayMessage = `You won! Final Score: ${gameState.overallScore.player1} - ${gameState.overallScore.player2}`;
        } else {
          matchOverDisplayMessage = `You lost! Final Score: ${gameState.overallScore.player1} - ${gameState.overallScore.player2}`;
        }
      } else {
        matchOverDisplayMessage = `Match Over! Final Score: ${gameState.overallScore.player1} - ${gameState.overallScore.player2}`;
      }
  }

  return (
    <div className={styles.displayContainer}>
      <div className={styles.textWrapper}>
        <div className={styles.statusMessage}>
          {gameState.isMatchOver
            ? matchOverDisplayMessage
            : gameState.statusMessage}
        </div>
        <div className={styles.roundResult}>
          {gameState.roundResultText && !gameState.isMatchOver ?
            gameState.roundResultText : ""
          }
        </div>
      </div>
      <div className={styles.playersContainer}>
        <div className={styles.player}>
          <div className={styles.emoji}>{gameState.player1Move ? MOVE_EMOJIS[gameState.player1Move] : "❔"}</div>
          <div className={styles.name}>{gameState.player1Name}</div>
        </div>
        <div className={styles.scoreBoard}>
          <span>{gameState.overallScore.player1}</span> : <span>{gameState.overallScore.player2}</span>
        </div>
        <div className={styles.player}>
          <div className={styles.emoji}>{gameState.player2Move ? MOVE_EMOJIS[gameState.player2Move] : "❔"}</div>
          <div className={styles.name}>{gameState.player2Name}</div>
        </div>
      </div>
    </div>
  );
}
