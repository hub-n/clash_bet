"use client";
import { useEffect, useState, useRef } from "react";
import RPSDisplay from "./components/RPSDisplay";
import RPSControls from "./components/RPSControls";
import styles from "./RPSGame.module.css";
import { GameSessionDetails } from "../../[gameId]/page";

interface RPSGameProps {
  gameId: string;
  initialData: GameSessionDetails | null;
  currentPlayerId: string | null;
}

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

const WEBSOCKET_URL_BASE =
  process.env.NEXT_PUBLIC_RPS_WEBSOCKET_URL || "ws://localhost:3001/api/rps/ws";

export default function RPSGame({ gameId, initialData, currentPlayerId }: RPSGameProps) {
  const [gameState, setGameState] = useState<RPSGameState>(() => {
    if (
      !initialData ||
      !initialData.players ||
      initialData.players.length < 2
    ) {
      return {
        player1Name: "Player 1",
        player2Name: "Player 2",
        player1Id: "",
        player2Id: "",
        player1Move: null,
        player2Move: null,
        overallScore: { player1: 0, player2: 0 },
        roundResultText: null,
        statusMessage: "Error: Waiting for valid game data.",
        isMatchOver: false,
        matchWinnerId: null,
        currentRoundNumber: 1,
      };
    }
    return {
      player1Name: initialData.players[0].name,
      player2Name: initialData.players[1].name,
      player1Id: initialData.players[0].id,
      player2Id: initialData.players[1].id,
      player1Move: null,
      player2Move: null,
      overallScore: { player1: 0, player2: 0 },
      roundResultText: null,
      statusMessage: "Initializing game...",
      isMatchOver: false,
      matchWinnerId: null,
      currentRoundNumber: 1,
    };
  });

  const [timer, setTimer] = useState<number>(15);
  const [playerMadeMoveThisRound, setPlayerMadeMoveThisRound] =
    useState<boolean>(false);
  const [buttonsOn, setButtonsOn] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (
      !initialData ||
      !initialData.players ||
      initialData.players.length < 2 ||
      !gameId
    ) {
      setGameState((prev) => ({
        ...prev,
        statusMessage: "Waiting for valid game data...",
      }));
      return;
    }

    setGameState((prev) => ({
      ...prev,
      statusMessage: "Connecting to game server...",
    }));

    const WEBSOCKET_URL = `${WEBSOCKET_URL_BASE}?gameId=${encodeURIComponent(
      gameId
    )}`;
    console.log(
      `RPSGame: Attempting to connect to WebSocket at: ${WEBSOCKET_URL}`
    );
    const ws = new WebSocket(WEBSOCKET_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("RPSGame: WebSocket Connected for gameId:", gameId);
      setGameState((prev) => ({
        ...prev,
        statusMessage: "Connected! Waiting for game to start...",
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        console.log(
          "RPSGame: WebSocket Message Received:",
          message,
          "for gameId:",
          gameId
        );

        switch (message.event) {
          case "round_result": {
            const { moves, roundWinnerId, overallScores, reason } =
              message.data;
            setGameState((prev) => {
              let resultText = "";
              if (reason) {
                resultText = reason;
              } else if (roundWinnerId === null) {
                resultText = "Round is a Draw!";
              } else if (String(roundWinnerId) === prev.player1Id) {
                resultText = `${prev.player1Name} wins the round!`;
              } else if (String(roundWinnerId) === prev.player2Id) {
                resultText = `${prev.player2Name} wins the round!`;
              }

              return {
                ...prev,
                player1Move: moves[prev.player1Id] || null,
                player2Move: moves[prev.player2Id] || null,
                overallScore: overallScores,
                roundResultText: resultText,
                statusMessage: "Round over. Preparing for next...",
              };
            });
            setButtonsOn(false);
            setPlayerMadeMoveThisRound(false);
            break;
          }
          case "new_round": {
            const { overallScores, roundNumber } = message.data;
            setGameState((prev) => ({
              ...prev,
              player1Move: null,
              player2Move: null,
              overallScore: overallScores,
              roundResultText: null,
              statusMessage: `Round ${roundNumber}! Make your move.`,
              currentRoundNumber: roundNumber,
            }));
            setTimer(15);
            setButtonsOn(true);
            setPlayerMadeMoveThisRound(false);
            break;
          }
          case "match_over": {
            const { winnerId, finalScores, reason } = message.data;
            setGameState((prev) => ({
              ...prev,
              isMatchOver: true,
              matchWinnerId: String(winnerId),
              overallScore: finalScores,
              statusMessage:
                reason ||
                `${
                  String(winnerId) === prev.player1Id
                    ? prev.player1Name
                    : prev.player2Name
                } wins the match! Final Score: ${finalScores.player1} - ${
                  finalScores.player2
                }`,
              roundResultText: null,
            }));
            setButtonsOn(false);
            if (socketRef.current)
              socketRef.current.close(1000, "Match concluded");
            break;
          }
          case "opponent_played":
            setGameState((prev) => ({
              ...prev,
              statusMessage: playerMadeMoveThisRound
                ? "Both played! Waiting for result..."
                : "Opponent played. Make your move!",
            }));
            break;
          case "game_state_update":
            setGameState((prev) => ({
              ...prev,
              overallScore: message.data.overallScores,
              statusMessage: "Reconnected. Current scores updated.",
            }));
            break;
          case "status_update":
            setGameState((prev) => ({
              ...prev,
              statusMessage: message.data.message,
            }));
            break;
          case "error":
            console.error(
              "RPSGame: Server Error Message:",
              message.data.message
            );
            setGameState((prev) => ({
              ...prev,
              statusMessage: `Server Error: ${message.data.message}`,
            }));
            break;
          default:
            console.warn("RPSGame: Unhandled WebSocket event:", message.event);
        }
      } catch (error) {
        console.error(
          "RPSGame: Failed to parse WebSocket message or update state:",
          error
        );
      }
    };

    ws.onerror = (errorEvent: Event) => {
      console.warn("RPSGame: WebSocket Error/Abrupt Close. Event:", errorEvent);
      setGameState((prev) => ({
        ...prev,
        statusMessage: "Connection issue. Refresh if problem persists.",
      }));
      setButtonsOn(false);
    };

    ws.onclose = (event: CloseEvent) => {
      console.log(
        `RPSGame: WebSocket Disconnected. Code: ${event.code}, Reason: '${event.reason}'`
      );
      if (!gameState.isMatchOver) {
        setGameState((prev) => ({
          ...prev,
          statusMessage: `Disconnected: ${
            event.reason || "Connection lost"
          }. Please refresh if match was not over.`,
        }));
      }
      setButtonsOn(false);
    };

    return () => {
      if (socketRef.current) {
        console.log("RPSGame: Closing WebSocket for gameId:", gameId);
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        if (
          socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING
        ) {
          socketRef.current.close(1000, "Component unmounting");
        }
        socketRef.current = null;
      }
    };
  }, [gameId, initialData]);

  useEffect(() => {
    if (
      !buttonsOn ||
      timer <= 0 ||
      gameState.isMatchOver ||
      playerMadeMoveThisRound
    )
      return;
    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(interval);
          if (buttonsOn && !playerMadeMoveThisRound) {
            setGameState((prev) => ({
              ...prev,
              statusMessage: "Time's up for this round! Waiting for server...",
            }));
          }
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer, buttonsOn, playerMadeMoveThisRound, gameState.isMatchOver]);

  const handleMove = (move: string) => {
    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      !playerMadeMoveThisRound &&
      !gameState.isMatchOver
    ) {
      setPlayerMadeMoveThisRound(true);
      setButtonsOn(false);
      setGameState((prev) => ({
        ...prev,
        statusMessage: "Move sent! Waiting for opponent...",
      }));

      const payload = { matchId: gameId, move: move };
      socketRef.current.send(JSON.stringify({ event: "play", payload }));
    } else {
      console.error("RPSGame: WebSocket not connected or move not allowed.");
      setGameState((prev) => ({
        ...prev,
        statusMessage: "Cannot send move now.",
      }));
    }
  };

  if (!initialData || !initialData.players || initialData.players.length < 2) {
    return (
      <div className={styles.rpsGameContainer}>
        <div className={styles.statusMessage}>
          Error: Initial game data invalid.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.rpsGameContainer}>
      {!gameState.isMatchOver && (
        <div className={styles.timer}>⏱️ {timer}s</div>
      )}
      <RPSDisplay
        gameState={gameState}
        userId={currentPlayerId}
      />
      {!gameState.isMatchOver && (
        <RPSControls
          onMove={handleMove}
          disabled={!buttonsOn || playerMadeMoveThisRound}
        />
      )}
      {playerMadeMoveThisRound &&
        !gameState.isMatchOver &&
        !gameState.player1Move &&
        !gameState.player2Move && (
          <div className={styles.waitingMessage}>
            You played. Waiting for opponent or round result...
          </div>
        )}
    </div>
  );
}
