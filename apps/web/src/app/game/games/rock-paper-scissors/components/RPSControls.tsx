import styles from "./RPSControls.module.css";

const MOVES = [
  { emoji: "✊", value: "rock" },
  { emoji: "✋", value: "paper" },
  { emoji: "✌️", value: "scissors" },
];

interface Props {
  onMove: (move: string) => void;
  disabled: boolean;
}

export default function RPSControls({ onMove, disabled }: Props) {
  return (
    <div className={styles.controlsContainer}>
      {MOVES.map((move) => (
        <button
          key={move.value}
          className={styles.button}
          onClick={() => onMove(move.value)}
          disabled={disabled}
        >
          {move.emoji}
        </button>
      ))}
    </div>
  );
}
