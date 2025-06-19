import styles from "./GameCard.module.css";

interface GameCardProps {
  id: string;
  icon: string;
  title: string;
  isSelected: boolean;
  onSelect: () => void;
}

export default function GameCard({ id, icon, title, isSelected, onSelect }: GameCardProps) {
  return (
    <div
      className={`${styles.cardLink} ${isSelected ? styles.selected : ""}`}
      onClick={onSelect}
    >
      <div className={styles.card}>
        <div className={styles.cardIcon}>{icon}</div>
        <div className={styles.cardTitle}>{title}</div>
      </div>
    </div>
  );
}
