"use client";

import { useEffect, useState, useRef } from "react";
import { GameSessionDetails } from "../../[gameId]/page";
import MSDisplay from "./components/MSDisplay";

export interface CellState {
  isRevealed: boolean;
  isFlagged: boolean;
  hasBomb: boolean;
  adjacentBombs: number;
}

interface MSGameProps {
  gameId: string;
  initialData: GameSessionDetails | null;
}

const DEFAULT_ROWS = 14;
const DEFAULT_COLS = 18;
const DEFAULT_BOMB_COUNT = 40;
const DEFAULT_INITIAL_TIME = 120;

const generateInitialField = (
  bombs: boolean[][],
  rows: number,
  cols: number
): CellState[][] => {
  const field: CellState[][] = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      const hasBomb = bombs[y][x];
      const adjacent = countAdjacentBombs(bombs, x, y, rows, cols);
      return {
        isRevealed: false,
        isFlagged: false,
        hasBomb,
        adjacentBombs: adjacent,
      };
    })
  );
  return field;
};

const countAdjacentBombs = (
  bombs: boolean[][],
  x: number,
  y: number,
  rows: number,
  cols: number
): number => {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && bombs[ny][nx]) {
        count++;
      }
    }
  }
  return count;
};

const WEBSOCKET_URL_BASE =
  process.env.NEXT_PUBLIC_MINESWEEPER_WEBSOCKET_URL ||
  "ws://localhost:3001/api/minesweeper/ws";

export default function MinesweeperGame({ gameId, initialData}: MSGameProps) {
  const [field, setField] = useState<CellState[][]>([]);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_INITIAL_TIME);
  const [gameActuallyOver, setGameActuallyOver] = useState(false);
  const [inputAllowed, setInputAllowed] = useState(false);
  const [score, setScore] = useState(0);
  const [revealedSafeCells, setRevealedSafeCells] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const clientGameStartTimeRef = useRef<number | null>(null);

  const [gameConfig, setGameConfig] = useState({
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    bombCount: DEFAULT_BOMB_COUNT,
    initialTime: DEFAULT_INITIAL_TIME,
  });

  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [opponentStatus, setOpponentStatus] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<any | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  console.log(
    `[MS_GAME_RENDER] gameId: ${gameId}, inputAllowed: ${inputAllowed}, timeLeft: ${timeLeft}, gameActuallyOver: ${gameActuallyOver}`
  );

  useEffect(() => {
    console.log("[MS_GAME_PLAYER_ID_EFFECT] Fetching player ID...");
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((sessionData) => {
        if (sessionData && sessionData.user && sessionData.user.UserID) {
          setMyPlayerId(String(sessionData.user.UserID));
          console.log(
            "[MS_GAME_PLAYER_ID_EFFECT] My Player ID set to:",
            String(sessionData.user.UserID)
          );
        } else {
          console.error(
            "[MS_GAME_PLAYER_ID_EFFECT] Could not determine current player ID from session.",
            sessionData
          );
        }
      })
      .catch((err) =>
        console.error(
          "[MS_GAME_PLAYER_ID_EFFECT] Error fetching session for player ID:",
          err
        )
      );
  }, []);

  useEffect(() => {
    console.log(
      `[MS_GAME_WS_EFFECT] Running for gameId: ${gameId}. initialData valid: ${!!initialData}`
    );
    if (
      !gameId ||
      !initialData ||
      !initialData.players ||
      initialData.players.length < 2
    ) {
      setStatusMessage("Waiting for valid game data...");
      console.log(
        "[MS_GAME_WS_EFFECT] Invalid gameId or initialData. Aborting WS setup."
      );
      return;
    }

    setStatusMessage("Connecting to game server...");
    console.log("[MS_GAME_WS_EFFECT] Attempting to connect to WebSocket...");
    const WEBSOCKET_URL = `${WEBSOCKET_URL_BASE}?gameId=${encodeURIComponent(
      gameId
    )}`;
    const ws = new WebSocket(WEBSOCKET_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatusMessage("Connected! Waiting for opponent and game start...");
      console.log(
        "[MS_GAME_WS_EFFECT] Minesweeper WS Connected for gameId:",
        gameId
      );
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string);
      console.log(
        "[MS_GAME_WS_EFFECT] Minesweeper WS Message Received:",
        JSON.stringify(message)
      );

      switch (message.event) {
        case "game_setup_ready":
          console.log(
            "[MS_GAME_WS_EFFECT] Received 'game_setup_ready'. Payload:",
            message.data
          );
          const {
            bombs,
            serverStartTimeMs,
            initialTimeSeconds,
            rows,
            cols,
            bombCount,
          } = message.data;
          setGameConfig({
            rows,
            cols,
            bombCount,
            initialTime: initialTimeSeconds,
          });
          console.log("[MS_GAME_WS_EFFECT] Game config set.");
          setField(generateInitialField(bombs, rows, cols));
          console.log("[MS_GAME_WS_EFFECT] Field generated.");
          setTimeLeft(initialTimeSeconds);
          console.log(
            "[MS_GAME_WS_EFFECT] TimeLeft set to:",
            initialTimeSeconds
          );
          setScore(0);
          console.log("[MS_GAME_WS_EFFECT] Score reset to 0.");
          setRevealedSafeCells(0);
          console.log("[MS_GAME_WS_EFFECT] RevealedSafeCells reset to 0.");
          setGameActuallyOver(false);
          console.log("[MS_GAME_WS_EFFECT] GameActuallyOver set to false.");
          setInputAllowed(true);
          console.log("[MS_GAME_WS_EFFECT] InputAllowed set to true.");
          clientGameStartTimeRef.current = Date.now();
          console.log(
            "[MS_GAME_WS_EFFECT] clientGameStartTimeRef set to:",
            clientGameStartTimeRef.current
          );
          setStatusMessage("Game started! Good luck!");
          console.log(
            "[MS_GAME_WS_EFFECT] StatusMessage updated for game start."
          );
          break;
        case "opponent_update":
          console.log(
            "[MS_GAME_WS_EFFECT] Received 'opponent_update'. Payload:",
            message.data
          );
          const {
            opponentScore,
            opponentTimeTakenSeconds,
            opponentLostByBomb,
            opponentWonByClear,
          } = message.data;
          let oppStatus = `Opponent: ${opponentScore} pts, ${opponentTimeTakenSeconds.toFixed(
            1
          )}s. `;
          if (opponentLostByBomb) oppStatus += "Hit a bomb!";
          else if (opponentWonByClear) oppStatus += "Cleared the board!";
          else oppStatus += "Finished.";
          setOpponentStatus(oppStatus);
          break;
        case "match_over":
          console.log(
            "[MS_GAME_WS_EFFECT] Received 'match_over'. Payload:",
            message.data
          );
          setMatchResult(message.data);
          setInputAllowed(false);
          setGameActuallyOver(true);
          let outcomeMessage = message.data.reason;
          if (myPlayerId && message.data.winnerId) {
            if (String(message.data.winnerId) === myPlayerId) {
              outcomeMessage = `You Won! ${message.data.reason}`;
            } else {
              outcomeMessage = `You Lost. ${message.data.reason}`;
            }
          } else if (!message.data.winnerId) {
            outcomeMessage = `It's a Draw! ${message.data.reason}`;
          }
          setStatusMessage(outcomeMessage);
          if (socketRef.current)
            socketRef.current.close(1000, "Match concluded");
          break;
        case "status_update":
          console.log(
            "[MS_GAME_WS_EFFECT] Received 'status_update'. Payload:",
            message.data
          );
          setStatusMessage(message.data.message);
          break;
        case "error":
          console.error(
            "[MS_GAME_WS_EFFECT] Received 'error' from server:",
            message.data.message
          );
          setStatusMessage(`Server Error: ${message.data.message}`);
          break;
        default:
          console.warn(
            "[MS_GAME_WS_EFFECT] Unhandled Minesweeper WS event:",
            message.event,
            "Payload:",
            message.data
          );
      }
    };

    ws.onerror = (errorEvent) => {
      setStatusMessage("Connection error. Refresh if persists.");
      console.error("[MS_GAME_WS_EFFECT] Minesweeper WS Error:", errorEvent);
      setInputAllowed(false);
    };

    ws.onclose = (closeEvent) => {
      console.log(
        `[MS_GAME_WS_EFFECT] Minesweeper WS Disconnected. Code: ${closeEvent.code}, Reason: '${closeEvent.reason}'`
      );
      if (!matchResult) {
        setStatusMessage(
          `Disconnected: ${closeEvent.reason || "Connection lost"}.`
        );
      }
      setInputAllowed(false);
    };

    return () => {
      console.log(
        `[MS_GAME_WS_EFFECT] Cleanup for gameId: ${gameId}. Closing WebSocket if open.`
      );
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        if (
          socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING
        ) {
          socketRef.current.close(1000, "Component unmounting");
          console.log(`[MS_GAME_WS_EFFECT] WebSocket closed in cleanup.`);
        }
        socketRef.current = null;
      }
    };
  }, [gameId, initialData]);

  useEffect(() => {
    console.log(
      `[MS_GAME_TIMER_EFFECT] Tick. inputAllowed: ${inputAllowed}, gameActuallyOver: ${gameActuallyOver}, timeLeft: ${timeLeft}, clientGameStartTimeRef: ${clientGameStartTimeRef.current}`
    );
    if (
      !inputAllowed ||
      gameActuallyOver ||
      timeLeft <= 0 ||
      !clientGameStartTimeRef.current
    ) {
      if (!inputAllowed)
        console.log(
          "[MS_GAME_TIMER_EFFECT] Timer not starting: input not allowed."
        );
      if (gameActuallyOver)
        console.log(
          "[MS_GAME_TIMER_EFFECT] Timer not starting: game actually over."
        );
      if (timeLeft <= 0)
        console.log(
          "[MS_GAME_TIMER_EFFECT] Timer not starting: time left is 0 or less."
        );
      if (!clientGameStartTimeRef.current)
        console.log(
          "[MS_GAME_TIMER_EFFECT] Timer not starting: clientGameStartTimeRef not set."
        );
      return;
    }
    console.log("[MS_GAME_TIMER_EFFECT] Starting timer interval.");
    const timerInterval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          console.log(
            "[MS_GAME_TIMER_EFFECT] Time is up (<=1). Clearing interval."
          );
          clearInterval(timerInterval);
          setGameActuallyOver(true);
          console.log(
            "[MS_GAME_TIMER_EFFECT] GameActuallyOver set to true due to time up."
          );
          setInputAllowed(false);
          console.log(
            "[MS_GAME_TIMER_EFFECT] InputAllowed set to false due to time up."
          );
          if (
            socketRef.current &&
            socketRef.current.readyState === WebSocket.OPEN &&
            clientGameStartTimeRef.current
          ) {
            const timeTaken =
              (Date.now() - clientGameStartTimeRef.current) / 1000;
            const updatePayload = {
              matchId: gameId,
              score: score,
              timeTakenSeconds: Math.min(timeTaken, gameConfig.initialTime),
              hitBomb: false,
              clearedBoard: false,
            };
            console.log(
              "[MS_GAME_TIMER_EFFECT] Sending game_update on time up:",
              updatePayload
            );
            socketRef.current.send(
              JSON.stringify({
                event: "game_update",
                payload: updatePayload,
              })
            );
            setStatusMessage("Time's up!");
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      console.log("[MS_GAME_TIMER_EFFECT] Cleanup: Clearing timer interval.");
      clearInterval(timerInterval);
    };
  }, [
    timeLeft,
    inputAllowed,
    gameActuallyOver,
    gameId,
    score,
    gameConfig.initialTime,
  ]);

  useEffect(() => {
    console.log(
      `[MS_GAME_GAMEOVER_EFFECT] gameActuallyOver: ${gameActuallyOver}, clientGameStartTimeRef: ${
        clientGameStartTimeRef.current
      }, socketReady: ${socketRef.current?.readyState === WebSocket.OPEN}`
    );
    if (
      !gameActuallyOver ||
      !clientGameStartTimeRef.current ||
      !socketRef.current ||
      socketRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const hitBomb =
      field.length > 0 &&
      field.some((row) => row.some((cell) => cell.isRevealed && cell.hasBomb));
    const won =
      field.length > 0 &&
      revealedSafeCells ===
        gameConfig.rows * gameConfig.cols - gameConfig.bombCount;
    console.log(
      `[MS_GAME_GAMEOVER_EFFECT] hitBomb: ${hitBomb}, won: ${won}, timeLeft: ${timeLeft}`
    );

    if ((hitBomb || won) && timeLeft > 0) {
      const timeTaken = (Date.now() - clientGameStartTimeRef.current) / 1000;
      const updatePayload = {
        matchId: gameId,
        score: score,
        timeTakenSeconds: timeTaken,
        hitBomb: hitBomb,
        clearedBoard: won,
      };
      console.log(
        "[MS_GAME_GAMEOVER_EFFECT] Sending game_update on win/loss (not timeout):",
        updatePayload
      );
      socketRef.current.send(
        JSON.stringify({
          event: "game_update",
          payload: updatePayload,
        })
      );
      if (hitBomb) {
        setStatusMessage("Boom! Game Over.");
        console.log("[MS_GAME_GAMEOVER_EFFECT] Player hit a bomb.");
      }
      if (won) {
        setStatusMessage("You cleared the board! Well done!");
        console.log("[MS_GAME_GAMEOVER_EFFECT] Player cleared the board.");
      }
    } else if (timeLeft <= 0) {
      console.log(
        "[MS_GAME_GAMEOVER_EFFECT] Game over due to time running out, update sent by timer effect."
      );
    }
  }, [
    gameActuallyOver,
    field,
    revealedSafeCells,
    score,
    gameId,
    gameConfig,
    timeLeft,
  ]);

  const revealCellsRecursive = (
    currentField: CellState[][],
    x: number,
    y: number,
    r: number,
    c: number
  ): { newField: CellState[][]; revealedCount: number } => {
    let revealedCount = 0;
    const stack: [number, number][] = [];

    const firstCell = currentField[y][x];
    if (
      firstCell.adjacentBombs === 0 &&
      !firstCell.isFlagged &&
      !firstCell.isRevealed
    ) {
      stack.push([x, y]);
    } else if (!firstCell.isFlagged && !firstCell.isRevealed) {
      currentField[y][x].isRevealed = true;
      if (!firstCell.hasBomb) revealedCount = 1;
      return { newField: currentField, revealedCount };
    } else {
      return { newField: currentField, revealedCount: 0 };
    }

    const visitedInRecursiveCall = new Set<string>();

    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      const key = `${cx},${cy}`;

      if (visitedInRecursiveCall.has(key)) continue;
      visitedInRecursiveCall.add(key);

      const cell = currentField[cy][cx];

      if (cell.isRevealed || cell.isFlagged) continue;

      cell.isRevealed = true;
      if (!cell.hasBomb) {
        revealedCount++;
      } else {
        return { newField: currentField, revealedCount };
      }

      if (cell.adjacentBombs === 0) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx >= 0 && nx < c && ny >= 0 && ny < r) {
              if (
                !currentField[ny][nx].isRevealed &&
                !currentField[ny][nx].isFlagged
              ) {
                stack.push([nx, ny]);
              }
            }
          }
        }
      }
    }
    return { newField: currentField, revealedCount };
  };

  const handleClick = (x: number, y: number) => {
    console.log(
      `[MS_GAME_HANDLE_CLICK] Clicked cell (${x}, ${y}). inputAllowed: ${inputAllowed}, gameActuallyOver: ${gameActuallyOver}`
    );
    if (!inputAllowed || gameActuallyOver || !field.length) return;

    const newField = field.map((row) => row.map((cell) => ({ ...cell })));
    const cell = newField[y][x];

    if (cell.isRevealed || cell.isFlagged) {
      console.log(
        `[MS_GAME_HANDLE_CLICK] Cell (${x}, ${y}) already revealed or flagged. No action.`
      );
      return;
    }

    if (cell.hasBomb) {
      console.log(`[MS_GAME_HANDLE_CLICK] Player hit a bomb at (${x}, ${y}).`);
      newField.forEach((row) =>
        row.forEach((c) => {
          if (c.hasBomb) c.isRevealed = true;
        })
      );
      setField(newField);
      setInputAllowed(false);
      setGameActuallyOver(true);
      return;
    }

    if (!cell.isRevealed) {
      console.log(`[MS_GAME_HANDLE_CLICK] Revealing safe cell (${x}, ${y}).`);
      const { newField: updatedFieldAfterRecursion, revealedCount } =
        revealCellsRecursive(newField, x, y, gameConfig.rows, gameConfig.cols);
      console.log(
        `[MS_GAME_HANDLE_CLICK] Revealed ${revealedCount} new cells.`
      );
      setScore((s) => s + revealedCount);
      setRevealedSafeCells((rs) => rs + revealedCount);
      setField(updatedFieldAfterRecursion);

      if (
        revealedSafeCells + revealedCount ===
        gameConfig.rows * gameConfig.cols - gameConfig.bombCount
      ) {
        console.log(
          "[MS_GAME_HANDLE_CLICK] All safe cells revealed. Player wins."
        );
        setInputAllowed(false);
        setGameActuallyOver(true);
      }
    }
  };

  const handleRightClick = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    console.log(
      `[MS_GAME_HANDLE_RIGHT_CLICK] Right-clicked cell (${x}, ${y}). inputAllowed: ${inputAllowed}, gameActuallyOver: ${gameActuallyOver}`
    );
    if (!inputAllowed || gameActuallyOver || !field.length) return;

    setField((prev) => {
      const newField = prev.map((row) => row.map((cell) => ({ ...cell })));
      const cell = newField[y][x];
      if (!cell.isRevealed) {
        cell.isFlagged = !cell.isFlagged;
        console.log(
          `[MS_GAME_HANDLE_RIGHT_CLICK] Cell (${x}, ${y}) flag toggled to ${cell.isFlagged}.`
        );
      } else {
        console.log(
          `[MS_GAME_HANDLE_RIGHT_CLICK] Cell (${x}, ${y}) already revealed. No flag action.`
        );
      }
      return newField;
    });
  };

  return (
    <MSDisplay
      field={field}
      timeLeft={timeLeft}
      score={score}
      gameOver={gameActuallyOver}
      handleClick={handleClick}
      handleRightClick={handleRightClick}
      statusMessage={statusMessage}
      opponentStatus={opponentStatus}
      matchResult={matchResult}
      myPlayerId={myPlayerId}
      initialData={initialData}
    />
  );
}
