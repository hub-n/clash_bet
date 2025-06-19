import { WebSocket as WsSocketType } from 'ws';

export interface MinesweeperPlayer {
  id: number;
  name: string;
  ws?: WsSocketType;
  disconnectTimer?: NodeJS.Timeout | null;
  score: number | null;
  timeTakenSeconds: number | null;
  finished: boolean;
  hitBomb: boolean;
  clearedBoard: boolean;
  timedOut: boolean;
  isReadyForGameStart: boolean;
}

export interface MinesweeperMatchState {
  dbMatchId: number;
  compositeMatchId: string;
  gameKey: string;
  player1: MinesweeperPlayer;
  player2: MinesweeperPlayer;
  stake: number;
  bombLocations: boolean[][];
  gameStarted: boolean;
  matchConcluded: boolean;
  rows: number;
  cols: number;
  bombCount: number;
  initialTime: number;
}

export interface ActiveMatchDetailsFromMM {
  compositeMatchId: string;
  gameKey: string;
  betAmount: number;
  playerOne: { id: number | string; name: string };
  playerTwo: { id: number | string; name: string };
}

export interface PlayerFinishedPayload {
  matchId: string;
  score: number;
  timeTakenSeconds: number;
  hitBomb: boolean;
  clearedBoard: boolean;
  timedOut: boolean;
}
