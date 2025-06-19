"use client";

import Link from "next/link";
import { useEffect, useState, Suspense, lazy } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheckIcon,
  PuzzlePieceIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import styles from "./GamePage.module.css";

interface PlayerData {
  id: string;
  name: string;
  emoji?: string;
}

export interface GameSessionDetails {
  id: string;
  type: string;
  betAmount: number;
  players: PlayerData[];
}

const BattleshipsGame = lazy(
  () => import("../games/battleships/BattleshipsGame")
);
const RPSGame = lazy(() => import("../games/rock-paper-scissors/RPSGame"));
const MinesweeperGame = lazy(
  () => import("../games/minesweeper/MinesweeperGame")
);

const getFriendlyGameName = (gameType: string): string => {
  switch (gameType) {
    case "battleships":
      return "Battleships";
    case "rock-paper-scissors":
      return "Rock, Paper, Scissors";
    default:
      if (gameType === "unknown-game" || !gameType) return "Unknown Game";
      return (
        gameType.charAt(0).toUpperCase() + gameType.slice(1).replace(/-/g, " ")
      );
  }
};

const PLAYER_EMOJIS = ["🧑‍🚀", "🧑‍🔬", "🧑‍🎨", "🧑‍💻", "🦸", "🦹"];

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const compositeGameId = params.gameId as string;

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [gameDetails, setGameDetails] = useState<GameSessionDetails | null>(
    null
  );
  const [isLoadingGameData, setIsLoadingGameData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      setIsAuthLoading(true);
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (data?.authenticated) {
            setIsAuthenticated(true);
            setCurrentUserId(data.user.UserID);
          } else {
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
      setIsAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!compositeGameId || !isAuthenticated || isAuthLoading) return;

    const fetchGameDetailsFromServer = async () => {
      setIsLoadingGameData(true);
      setError(null);
      console.log(
        "[GamePage] Fetching game details for compositeGameId:",
        compositeGameId
      );

      try {
        const response = await fetch(`/api/matches/${compositeGameId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            message: `HTTP error! status: ${response.status}`,
          }));
          const errorMessage =
            errorData.message ||
            `Failed to load game details. Status: ${response.status}`;
          console.error(
            "[GamePage] Error fetching game details:",
            errorMessage,
            errorData
          );
          setError(errorMessage);
          setGameDetails(null);
          setIsLoadingGameData(false);
          return;
        }

        const data: GameSessionDetails = await response.json();
        console.log("[GamePage] Received game session data from server:", data);

        if (!data || !data.players || data.players.length < 2 || !data.type) {
          console.error(
            "[GamePage] Invalid data structure or missing game type received from server:",
            data
          );
          setError("Invalid game data or game type missing from server.");
          setGameDetails(null);
          setIsLoadingGameData(false);
          return;
        }

        setGameDetails({
          id: data.id,
          type: data.type,
          betAmount: data.betAmount,
          players: data.players.map((player, index) => ({
            ...player,
            id: String(player.id),
            emoji: PLAYER_EMOJIS[index % PLAYER_EMOJIS.length],
          })),
        });
      } catch (err: any) {
        console.error(
          "[GamePage] Network or parsing error in fetchGameDetailsFromServer:",
          err
        );
        setError(
          err.message || "A network error occurred while fetching game details."
        );
        setGameDetails(null);
      } finally {
        setIsLoadingGameData(false);
      }
    };

    fetchGameDetailsFromServer();
  }, [compositeGameId, isAuthenticated, isAuthLoading, router]);

  // ----- Render Game Component Function -----
  const renderGameComponent = () => {
    if (!gameDetails) return null;

    switch (gameDetails.type) {
      case "battleships":
        return (
          <BattleshipsGame gameId={gameDetails.id} initialData={gameDetails} />
        );
      case "rock-paper-scissors":
        return <RPSGame gameId={gameDetails.id} initialData={gameDetails} currentPlayerId={currentUserId} />
      case "minesweeper":
        return (
          <MinesweeperGame gameId={gameDetails.id} initialData={gameDetails} />
        );
      default:
        return (
          <div className={styles.gameAreaPlaceholderText}>
            <ShieldCheckIcon className={styles.gameAreaPlaceholderIcon} />
            <h2>Unsupported Game Type</h2>
            <p>
              The game type "{gameDetails.type}" is not currently supported.
            </p>
          </div>
        );
    }
  };

  // ----- UI Rendering Logic -----
  if (isAuthLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
        <svg
          className={styles.loadingSpinner}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p>Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isLoadingGameData) {
    return (
      <div className={styles.loadingScreen}>
        <svg
          className={styles.loadingSpinner}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        ></svg>
        <p className="text-xl">Establishing Connection...</p>
        <p className="text-sm">Game ID: {compositeGameId}</p>
      </div>
    );
  }

  if (error || !gameDetails) {
    return (
      <div className={styles.errorScreen}>
        <ExclamationTriangleIcon className={styles.errorIcon} />
        <h1 className={styles.errorTitle}>Game Connection Error</h1>
        <p className={styles.errorMessage}>
          {error || "Game details are unavailable."}
        </p>
        <button
          onClick={() => router.push("/dashboard/waitroom")}
          className="px-6 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg shadow-md transition duration-150"
        >
          Return to Waitroom
        </button>
      </div>
    );
  }

  const PlayerInfo = ({ player }: { player: PlayerData }) => (
    <>
      <span
        className={styles.playerAvatarEmoji}
        role="img"
        aria-label="player avatar"
      >
        {player.emoji}
      </span>
      <h3 className={styles.playerName}>{player.name}</h3>
      <p className={styles.playerStatus}>Ready</p>
    </>
  );

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        <header className={styles.gameInfoHeader}>
          <Link href="/dashboard" className={styles.backButton}>
            ← Back to Dashboard
          </Link>
          <div className={styles.gameDetailsGroup}>
            <div className={styles.gameTitleContainer}>
              <PuzzlePieceIcon className={styles.gameTitleIcon} />
              <h1 className={styles.gameTitleText}>
                {getFriendlyGameName(gameDetails.type)}
              </h1>
            </div>
            <div className={styles.betInfoContainer}>
              <span>Reward:</span>
              <strong className={styles.betInfoTextStrong}>
                {1.75*gameDetails.betAmount} 💎
              </strong>
            </div>
          </div>
        </header>

        <main className={styles.mainGameArena}>
          <div className={`${styles.playerPanel} ${styles.playerPanelOrder1}`}>
            <PlayerInfo player={gameDetails.players[0]} />
          </div>

          <div className={styles.gameBoardArea}>
            <Suspense
              fallback={
                <div className={styles.suspenseFallbackText}>
                  <svg
                    className={styles.loadingSpinner}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  ></svg>
                  <p>Loading Game Module...</p>
                </div>
              }
            >
              {renderGameComponent()}
            </Suspense>
          </div>

          <div className={`${styles.playerPanel} ${styles.playerPanelOrder3}`}>
            <PlayerInfo player={gameDetails.players[1]} />
          </div>
        </main>
      </div>
    </div>
  );
}