export interface RPSGameState {
  player1: string;
  player2: string;
  player1Move: string | null;
  player2Move: string | null;
  score: {
    player1: number;
    player2: number;
  };
}

const initialState: RPSGameState = {
  player1: "You",
  player2: "Opponent",
  player1Move: null,
  player2Move: null,
  score: {
    player1: 0,
    player2: 0,
  }
};

let gameState: RPSGameState = { ...initialState };

export async function getGameState(gameId: string) {
  return { ...gameState };
}

export async function sendMove(gameId: string, move: string): Promise<RPSGameState> {
  // Simulate game result update
  await new Promise((resolve) => setTimeout(resolve, 1000));
    const moves = ["rock", "paper", "scissors"] as const;
    const opponentMove = moves[Math.floor(Math.random() * 3)];

    gameState.player1Move = move;
    gameState.player2Move = opponentMove;

     const result = getRoundResult(move, opponentMove);

    if (result === 1) gameState.score.player1 += 1;
    else if (result === -1) gameState.score.player2 += 1;

    return { ...gameState };
}

function getRoundResult(
  player1Move: string,
  player2Move: string
): 1 | 0 | -1 {
  if (player1Move === player2Move) return 0;
  if (
    (player1Move === "rock" && player2Move === "scissors") ||
    (player1Move === "scissors" && player2Move === "paper") ||
    (player1Move === "paper" && player2Move === "rock")
  ) {
    return 1;
  }
  return -1;
}