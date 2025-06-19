"use client";

import React, { useState, useEffect, Suspense, ReactNode, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./waitroom.module.css";

const GAMES_DATA: {
  [key: string]: { name: string; description: string; icon?: string };
} = {
  "rock-paper-scissors": {
    name: "Rock, Paper, Scissors",
    description: "The classic game of choices. Outsmart your opponent!",
  },
  battleships: {
    name: "Battleships",
    description:
      "Command your fleet and sink the enemy. Strategic warfare awaits.",
  },
  minesweeper: {
    name: "Minesweeper",
    description: "Clear the field, avoid the mines. A test of logic and luck.",
  },
};

const DEFAULT_RANGE_MESSAGE =
  "Enter your base bet and range to see your match criteria.";

interface FoundRoomDetails {
  finalBetAmount: number;
  matchId: string;
  message?: string;
}

const getWebSocketURL = () => {
  const backendHostAndPort = "localhost:3001";
  const backendPath = "/api/matchmaking/ws";
  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss:"
      : "ws:";
  return `${protocol}//${backendHostAndPort}${backendPath}`;
};

function WaitroomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId");
  const [authCheckLoading, setAuthCheckLoading] = useState(true);

  const [gameData, setGameData] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const [betAmount, setBetAmount] = useState<string>("");
  const [fluctuationAmount, setFluctuationAmount] = useState<string>("");
  const [isLoadingGameData, setIsLoadingGameData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [bettingRangeDisplay, setBettingRangeDisplay] = useState<ReactNode>(
    DEFAULT_RANGE_MESSAGE
  );
  const [isFindingRoom, setIsFindingRoom] = useState(false);
  const [roomSearchError, setRoomSearchError] = useState<string | null>(null);
  const [foundRoomDetails, setFoundRoomDetails] =
    useState<FoundRoomDetails | null>(null);
  const [waitingStatusMessage, setWaitingStatusMessage] = useState<string>(
    "Finding a suitable match, please wait..."
  );
  const socketRef = useRef<WebSocket | null>(null);

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

  useEffect(() => {
    if (authCheckLoading) return;

    setIsLoadingGameData(true);
    setError(null);
    setValidationError(null);
    setRoomSearchError(null);
    setFoundRoomDetails(null);

    if (gameId && GAMES_DATA[gameId]) {
      setGameData(GAMES_DATA[gameId]);
    } else if (gameId) {
      setError(
        `Game Configuration Error: Could not find settings for "${gameId}".`
      );
      setGameData(null);
    } else {
      setError(
        "Game Selection Error: No game ID specified in the URL. Please select a game from the dashboard."
      );
      setGameData(null);
    }
    setIsLoadingGameData(false);
  }, [gameId, authCheckLoading]);

  useEffect(() => {
    const bet = parseFloat(betAmount);
    const fluctuation = parseFloat(fluctuationAmount);
    let isValidForRangeCalculation = true;
    if (!betAmount || !fluctuationAmount) {
      isValidForRangeCalculation = false;
    } else if (isNaN(bet) || bet <= 0) {
      isValidForRangeCalculation = false;
    } else if (isNaN(fluctuation) || fluctuation < 0) {
      isValidForRangeCalculation = false;
    } else if (fluctuation >= bet) {
      isValidForRangeCalculation = false;
    }
    if (isValidForRangeCalculation) {
      const minBet = bet - fluctuation;
      const maxBet = bet + fluctuation;
      setBettingRangeDisplay(
        <>
          Your match will have a bet between{" "}
          <strong>{minBet.toLocaleString()}</strong> and{" "}
          <strong>{maxBet.toLocaleString()}</strong>.
        </>
      );
    } else {
      setBettingRangeDisplay(DEFAULT_RANGE_MESSAGE);
    }
  }, [betAmount, fluctuationAmount]);

  const connectWebSocket = (currentRoomId: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    const WEBSOCKET_URL = getWebSocketURL();
    socketRef.current = new WebSocket(WEBSOCKET_URL);
    setWaitingStatusMessage(
      `Connecting to matchmaking server for room ${currentRoomId}...`
    );
    socketRef.current.onopen = () => {
      setWaitingStatusMessage(
        `In waiting room ${currentRoomId}. Listening for opponent...`
      );
    };
    socketRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        if (message.event === "match_found" && message.data) {
          setIsFindingRoom(false);
          setFoundRoomDetails({
            finalBetAmount: message.data.EntryFee,
            matchId: message.data.MatchID,
            message: `Opponent found! Game ID: ${message.data.MatchID}`,
          });
          setRoomSearchError(null);
          if (socketRef.current) socketRef.current.close();
        }
      } catch (e) {
        setIsFindingRoom(false);
        setRoomSearchError("Error processing update from matchmaking server.");
        setFoundRoomDetails(null);
      }
    };
    socketRef.current.onerror = (errorEvent) => {
      setIsFindingRoom(false);
      setRoomSearchError(
        "Connection error with matchmaking server. Please try again."
      );
      setFoundRoomDetails(null);
    };
    socketRef.current.onclose = (closeEvent) => {
      if (!closeEvent.wasClean && !foundRoomDetails && isFindingRoom) {
        setIsFindingRoom(false);
        setRoomSearchError(
          "Disconnected from matchmaking. Please try searching again."
        );
        setFoundRoomDetails(null);
      }
      socketRef.current = null;
    };
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  const handleFindRoom = async () => {
    setValidationError(null);
    setRoomSearchError(null);
    setFoundRoomDetails(null);
    setWaitingStatusMessage("Finding a suitable match, please wait...");
    const bet = parseFloat(betAmount);
    const fluctuation = parseFloat(fluctuationAmount);
    if (isNaN(bet) || bet <= 0) {
      setValidationError("Betting amount must be a positive number.");
      return;
    }
    if (isNaN(fluctuation) || fluctuation < 0) {
      setValidationError("Fluctuation amount must be a non-negative number.");
      return;
    }
    if (fluctuation >= bet) {
      setValidationError(
        "Fluctuation cannot be greater than or equal to the bet amount."
      );
      return;
    }
    if (!gameId) {
      setValidationError("Game ID is missing. Cannot start the game.");
      return;
    }
    setIsFindingRoom(true);
    try {
      const response = await fetch("/api/matchmaking/find-or-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, targetFee: bet, feeRange: fluctuation }),
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        const errorMsg =
          result.message || `Error ${response.status}: ${response.statusText}`;
        setIsFindingRoom(false);
        setRoomSearchError(errorMsg);
        return;
      }
      if (result.status === "matched" && result.match) {
        setIsFindingRoom(false);
        setFoundRoomDetails({
          finalBetAmount: result.match.EntryFee,
          matchId: result.match.MatchID,
          message: `Direct Match Found! Game ID: ${result.match.MatchID}`,
        });
      } else if (
        (result.status === "waiting" || result.status === "already_waiting") &&
        result.room
      ) {
        setWaitingStatusMessage(
          result.message || `Waiting in room ${result.room.MatchID}...`
        );
        connectWebSocket(result.room.MatchID);
      } else {
        setIsFindingRoom(false);
        setRoomSearchError(
          result.message || "An unexpected response from matchmaking server."
        );
      }
    } catch (err: any) {
      setIsFindingRoom(false);
      setRoomSearchError(
        "Network error or server is unreachable. Please try again."
      );
    }
  };

  const handleJoinGame = () => {
    if (foundRoomDetails && foundRoomDetails.matchId) {
      router.push(`/game/${foundRoomDetails.matchId}`);
    } else {
      setRoomSearchError(
        "Error preparing game link. Match details are missing."
      );
    }
  };

  const resetSearch = () => {
    setIsFindingRoom(false);
    setRoomSearchError(null);
    setFoundRoomDetails(null);
    setValidationError(null);
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  if (authCheckLoading || isLoadingGameData) {
    return <div className={styles.loading}>Initializing Game Setup...</div>;
  }
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2>Setup Failed</h2>
        <p>{error}</p>
        <Link
          href="/dashboard"
          className={`${styles.button} ${styles.secondaryButton}`}
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }
  if (!gameData) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>🚫</div>
        <h2>Game Not Found</h2>
        <p>
          The requested game configuration could not be loaded. It might be
          unavailable or the link may be incorrect.
        </p>
        <Link
          href="/dashboard"
          className={`${styles.button} ${styles.secondaryButton}`}
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.waitroomContainer}>
      <header className={styles.header}>
        <h1>{gameData.name}</h1>
        {gameData.description && (
          <p className={styles.gameDescription}>{gameData.description}</p>
        )}
      </header>
      {!isFindingRoom && !foundRoomDetails && !roomSearchError && (
        <>
          <section className={styles.settingsSection}>
            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label htmlFor="betAmount" className={styles.label}>
                  Base Bet
                </label>
                <input
                  type="number"
                  id="betAmount"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="e.g., 100"
                  className={`${styles.inputField} ${styles.betInput}`}
                  aria-describedby="validationError bettingRangeInfo"
                />
              </div>
              <span className={styles.plusMinusSign}>+/-</span>
              <div className={styles.inputGroup}>
                <label htmlFor="fluctuationAmount" className={styles.label}>
                  Range
                </label>
                <input
                  type="number"
                  id="fluctuationAmount"
                  value={fluctuationAmount}
                  onChange={(e) => setFluctuationAmount(e.target.value)}
                  placeholder="e.g., 10"
                  className={`${styles.inputField} ${styles.fluctuationInput}`}
                  aria-describedby="validationError bettingRangeInfo"
                />
              </div>
            </div>
            {validationError && (
              <p
                id="validationError"
                className={styles.validationErrorText}
                role="alert"
              >
                {validationError}
              </p>
            )}
          </section>
          <div
            id="bettingRangeInfo"
            className={styles.bettingRangeInfo}
            role="status"
          >
            {bettingRangeDisplay}
          </div>
        </>
      )}
      {isFindingRoom && (
        <div className={styles.loadingSpinnerContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.findingMatchText}>{waitingStatusMessage}</p>
        </div>
      )}
      {roomSearchError && !isFindingRoom && (
        <div className={styles.roomSearchErrorText} role="alert">
          <p>⚠️ {roomSearchError}</p>
          <button
            onClick={resetSearch}
            className={`${styles.button} ${styles.primaryButton}`}
            style={{ marginTop: "10px" }}
          >
            Try Again
          </button>
        </div>
      )}
      {foundRoomDetails && !isFindingRoom && (
        <div className={styles.matchFoundInfo}>
          <h3>Match Found!</h3>
          {foundRoomDetails.message && <p>{foundRoomDetails.message}</p>}
          <span className={styles.finalBetAmountLabel}>
            You'll be playing for:
          </span>
          <span className={styles.finalBetAmountValue}>
            {foundRoomDetails.finalBetAmount.toLocaleString()}
          </span>
          <button
            onClick={handleJoinGame}
            className={`${styles.button} ${styles.primaryButton}`}
          >
            Join Game
          </button>
        </div>
      )}
      {!isFindingRoom && !foundRoomDetails && !roomSearchError && (
        <section className={styles.actionsSection}>
          <button
            onClick={handleFindRoom}
            className={`${styles.button} ${styles.primaryButton}`}
            disabled={
              !betAmount || !fluctuationAmount || !gameId
            }
          >
            Confirm & Find Match
          </button>
          <Link
            href="/dashboard"
            className={`${styles.button} ${styles.secondaryButton}`}
            style={{ marginLeft: "10px" }}
          >
            Back to Dashboard
          </Link>
        </section>
      )}
      {(foundRoomDetails || roomSearchError) && !isFindingRoom && (
        <section
          className={styles.actionsSection}
          style={{ marginTop: "20px" }}
        >
          <Link
            href="/dashboard"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={resetSearch}
          >
            Back to Dashboard
          </Link>
        </section>
      )}
    </div>
  );
}

export default function WaitroomPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.loadingPage}>Preparing Your Game...</div>
      }
    >
      <WaitroomContent />
    </Suspense>
  );
}
