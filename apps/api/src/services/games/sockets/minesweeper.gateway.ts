import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket, RawData } from 'ws';
import * as url from 'url';
import { MatchesService } from 'src/services/matches/matches.service';
import { MatchmakingService } from 'src/services/matches/matchmaking/matchmaking.service';

const ROWS = 14;
const COLS = 18;
const BOMB_COUNT = 40;
const INITIAL_TIME_SECONDS = 120;
const PLAYER_RECONNECT_GRACE_PERIOD_MS = 30000;

interface ActiveMatchDetailsFromMM {
  compositeMatchId: string;
  gameKey: string;
  betAmount: number;
  playerOne: { id: number | string; name: string };
  playerTwo: { id: number | string; name: string };
}

interface MinesweeperPlayer {
  id: number;
  name: string;
  ws?: WebSocket;
  disconnectTimer?: NodeJS.Timeout | null;
  score: number;
  timeTakenSeconds: number;
  gameLostByBomb: boolean;
  gameWonByClear: boolean;
  timedOutOrStillPlaying: boolean;
  isReadyForGameStart: boolean;
  hasReceivedGameSetup: boolean;
  gameEndTimeMs: number | null;
}

interface MinesweeperMatchState {
  dbMatchId: number;
  compositeMatchId: string;
  gameKey: string;
  player1: MinesweeperPlayer;
  player2: MinesweeperPlayer;
  stake: number;
  bombLocations: boolean[][];
  matchOverallTimer: NodeJS.Timeout | null;
  matchStartTimeMs: number | null;
  isMatchConcluded: boolean;
  rows: number;
  cols: number;
  bombCount: number;
  initialTimeSeconds: number;
}

function generateBombLocationsServer(
  rows: number,
  cols: number,
  bombCount: number,
): boolean[][] {
  const field: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false),
  );
  let bombsPlaced = 0;
  while (bombsPlaced < bombCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!field[r][c]) {
      field[r][c] = true;
      bombsPlaced++;
    }
  }
  return field;
}

@WebSocketGateway({
  path: '/api/minesweeper/ws',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class MinesweeperGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private logger = new Logger('MinesweeperGateway');
  private activeMinesweeperMatches: Map<string, MinesweeperMatchState> =
    new Map();

  constructor(
    private readonly matchesService: MatchesService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  async handleConnection(client: WebSocket, ...args: any[]) {
    const request = args[0];
    const userSession = request.user;
    const userId = userSession?.UserID;
    const username = userSession?.Username;

    this.logger.log(
      `[GATEWAY] WS Connection attempt: UserID ${userId}, Username ${username}`,
    );

    if (!userId || !username) {
      this.logger.warn(
        '[GATEWAY] WS Auth failed: UserID or Username missing. Closing.',
      );
      client.close(1008, 'Not authenticated for WebSocket');
      return;
    }

    const parsedUrl = url.parse(request.url || '', true);
    const compositeMatchId = parsedUrl.query.gameId as string;

    if (!compositeMatchId) {
      this.logger.warn(
        `[GATEWAY] User ${userId} connected to Minesweeper WS without gameId. Closing.`,
      );
      client.close(1008, 'Game ID required for Minesweeper session');
      return;
    }
    this.logger.log(
      `[GATEWAY] User ${userId} attempting to connect to match ${compositeMatchId}`,
    );

    client.on('message', (data: RawData) =>
      this.onClientMessage(userId, compositeMatchId, data, client),
    );
    client.on('close', (code, reason) =>
      this.onClientDisconnect(
        userId,
        compositeMatchId,
        code,
        reason.toString(),
      ),
    );
    client.on('error', (error) =>
      this.logger.error(
        `[GATEWAY] WS Error (UserID ${userId}, Match ${compositeMatchId}):`,
        error,
      ),
    );

    await this.initializeOrRejoinMinesweeperMatch(
      compositeMatchId,
      userId,
      username,
      client,
    );
  }

  private async initializeOrRejoinMinesweeperMatch(
    compositeMatchId: string,
    userId: number,
    username: string,
    wsClient: WebSocket,
  ) {
    this.logger.log(
      `[INIT_REJOIN] User ${userId} (${username}) - Match ${compositeMatchId}: Starting process.`,
    );
    let matchState = this.activeMinesweeperMatches.get(compositeMatchId);

    if (!matchState) {
      this.logger.log(
        `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: No existing state. Initializing...`,
      );
      const mmDetails: ActiveMatchDetailsFromMM | undefined =
        this.matchmakingService.getActiveMatchDetails(compositeMatchId);

      if (
        !mmDetails ||
        !mmDetails.playerOne ||
        !mmDetails.playerTwo ||
        typeof mmDetails.betAmount !== 'number' ||
        typeof mmDetails.gameKey !== 'string' ||
        mmDetails.gameKey.trim() === ''
      ) {
        this.logger.error(
          `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: Failed to get valid MM details. Details: ${JSON.stringify(mmDetails)}`,
        );
        this.sendToClient(wsClient, 'error', {
          message: 'Game setup error: Incomplete match details.',
        });
        wsClient.close(1011, 'Incomplete match details');
        return;
      }

      const p1Id = Number(mmDetails.playerOne.id);
      const p2Id = Number(mmDetails.playerTwo.id);

      if (userId !== p1Id && userId !== p2Id) {
        this.logger.warn(
          `[INIT_REJOIN] User ${userId} (${username}) - Match ${compositeMatchId}: User not part of MM players (P1: ${p1Id}, P2: ${p2Id}). Denying.`,
        );
        this.sendToClient(wsClient, 'error', {
          message: 'Not authorized for this game.',
        });
        wsClient.close(1008, 'User not part of game');
        return;
      }

      try {
        const startMatchResult = await this.matchesService.startMatch(
          p1Id,
          p2Id,
          mmDetails.betAmount,
          mmDetails.gameKey,
          compositeMatchId,
        );
        this.logger.log(
          `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: MatchesService.startMatch result: DB MatchID ${startMatchResult.matchId}, Existed: ${startMatchResult.alreadyExisted}`,
        );

        matchState = {
          dbMatchId: startMatchResult.matchId,
          compositeMatchId,
          gameKey: mmDetails.gameKey,
          player1: {
            id: p1Id,
            name: mmDetails.playerOne.name,
            score: 0,
            timeTakenSeconds: 0,
            gameLostByBomb: false,
            gameWonByClear: false,
            timedOutOrStillPlaying: true,
            isReadyForGameStart: false,
            hasReceivedGameSetup: false,
            gameEndTimeMs: null,
          },
          player2: {
            id: p2Id,
            name: mmDetails.playerTwo.name,
            score: 0,
            timeTakenSeconds: 0,
            gameLostByBomb: false,
            gameWonByClear: false,
            timedOutOrStillPlaying: true,
            isReadyForGameStart: false,
            hasReceivedGameSetup: false,
            gameEndTimeMs: null,
          },
          stake: mmDetails.betAmount,
          bombLocations: generateBombLocationsServer(ROWS, COLS, BOMB_COUNT),
          matchOverallTimer: null,
          matchStartTimeMs: null,
          isMatchConcluded: false,
          rows: ROWS,
          cols: COLS,
          bombCount: BOMB_COUNT,
          initialTimeSeconds: INITIAL_TIME_SECONDS,
        };
        this.activeMinesweeperMatches.set(compositeMatchId, matchState);
        this.logger.log(
          `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: Minesweeper Match state (DB ${matchState.dbMatchId}) created and stored.`,
        );
      } catch (error) {
        this.logger.error(
          `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: Critical error during game init:`,
          error,
        );
        this.sendToClient(wsClient, 'error', {
          message: 'Server error: Failed to initialize game.',
        });
        wsClient.close(1011, 'Server game init error');
        return;
      }
    } else {
      this.logger.log(
        `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: Found existing match state.`,
      );
    }

    const connectingPlayer =
      userId === matchState.player1.id
        ? matchState.player1
        : matchState.player2;
    const opponentPlayer =
      userId === matchState.player1.id
        ? matchState.player2
        : matchState.player1;

    connectingPlayer.ws = wsClient;
    connectingPlayer.isReadyForGameStart = true;
    this.logger.log(
      `[INIT_REJOIN] User ${userId} (${username}) - Match ${compositeMatchId}: Set isReadyForGameStart = true. Player WS assigned.`,
    );

    if (connectingPlayer.disconnectTimer) {
      clearTimeout(connectingPlayer.disconnectTimer);
      connectingPlayer.disconnectTimer = null;
      this.logger.log(
        `[INIT_REJOIN] User ${userId} (${username}) - Match ${compositeMatchId}: Reconnected. Disconnect timer cleared.`,
      );
      if (opponentPlayer.ws) {
        this.sendToClient(opponentPlayer.ws, 'status_update', {
          message: `${username} has reconnected.`,
        });
      }
    } else {
      this.logger.log(
        `[INIT_REJOIN] User ${userId} (${username}) - Match ${compositeMatchId}: Fresh connection.`,
      );
    }

    if (matchState.isMatchConcluded) {
      this.logger.log(
        `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: Match already concluded. Sending final state.`,
      );
      this.determineWinnerAndResolve(matchState, true);
      return;
    }

    this.logger.log(
      `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: P1 Ready: ${matchState.player1.isReadyForGameStart}, P2 Ready: ${matchState.player2.isReadyForGameStart}, Match Start Time: ${matchState.matchStartTimeMs}`,
    );

    if (
      matchState.player1.isReadyForGameStart &&
      matchState.player2.isReadyForGameStart &&
      !matchState.matchStartTimeMs
    ) {
      this.logger.log(
        `[INIT_REJOIN] Match ${compositeMatchId}: Both players ready. Preparing to send initial game_setup_ready.`,
      );
      this.logger.log(
        `[INIT_REJOIN] Match ${compositeMatchId}: P1 WS state: ${matchState.player1.ws?.readyState}, P2 WS state: ${matchState.player2.ws?.readyState}`,
      );

      matchState.matchStartTimeMs = Date.now();
      this.logger.log(
        `[INIT_REJOIN] Match ${compositeMatchId}: Set matchStartTimeMs to ${matchState.matchStartTimeMs}.`,
      );

      const gameSetupPayload = {
        matchId: compositeMatchId,
        bombs: matchState.bombLocations,
        serverStartTimeMs: matchState.matchStartTimeMs,
        initialTimeSeconds: matchState.initialTimeSeconds,
        rows: matchState.rows,
        cols: matchState.cols,
        bombCount: matchState.bombCount,
      };

      if (
        matchState.player1.ws &&
        matchState.player1.ws.readyState === WebSocket.OPEN
      ) {
        this.sendToClient(
          matchState.player1.ws,
          'game_setup_ready',
          gameSetupPayload,
        );
        matchState.player1.hasReceivedGameSetup = true;
        this.logger.log(
          `[INIT_REJOIN] Match ${compositeMatchId}: Sent game_setup_ready to Player 1 (${matchState.player1.id}) and flagged as received.`,
        );
      } else {
        this.logger.error(
          `[INIT_REJOIN] Match ${compositeMatchId}: Could not send initial game_setup_ready to Player 1 (${matchState.player1.id}) - WS state: ${matchState.player1.ws?.readyState}`,
        );
      }
      if (
        matchState.player2.ws &&
        matchState.player2.ws.readyState === WebSocket.OPEN
      ) {
        this.sendToClient(
          matchState.player2.ws,
          'game_setup_ready',
          gameSetupPayload,
        );
        matchState.player2.hasReceivedGameSetup = true;
        this.logger.log(
          `[INIT_REJOIN] Match ${compositeMatchId}: Sent game_setup_ready to Player 2 (${matchState.player2.id}) and flagged as received.`,
        );
      } else {
        this.logger.error(
          `[INIT_REJOIN] Match ${compositeMatchId}: Could not send initial game_setup_ready to Player 2 (${matchState.player2.id}) - WS state: ${matchState.player2.ws?.readyState}`,
        );
      }

      matchState.matchOverallTimer = setTimeout(() => {
        this.logger.log(
          `[TIMER] Match ${compositeMatchId}: Overall timer EXPIRED.`,
        );
        this.handleMatchTimeout(matchState);
      }, matchState.initialTimeSeconds * 1000);
      this.logger.log(
        `[INIT_REJOIN] Match ${compositeMatchId}: Overall match timer started for ${matchState.initialTimeSeconds}s.`,
      );
    } else if (matchState.matchStartTimeMs) {
      this.logger.log(
        `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: Game already started (startTime: ${matchState.matchStartTimeMs}). Player ${username} (ID: ${userId}) is connecting/rejoining.`,
      );

      if (!connectingPlayer.hasReceivedGameSetup) {
        this.logger.log(
          `[INIT_REJOIN] Match ${compositeMatchId}: Reconnecting Player ${userId} (${username}) MISSED initial game_setup_ready. Resending.`,
        );
        const gameSetupPayload = {
          matchId: compositeMatchId,
          bombs: matchState.bombLocations,
          serverStartTimeMs: matchState.matchStartTimeMs,
          initialTimeSeconds: matchState.initialTimeSeconds,
          rows: matchState.rows,
          cols: matchState.cols,
          bombCount: matchState.bombCount,
        };
        if (
          connectingPlayer.ws &&
          connectingPlayer.ws.readyState === WebSocket.OPEN
        ) {
          this.sendToClient(
            connectingPlayer.ws,
            'game_setup_ready',
            gameSetupPayload,
          );
          connectingPlayer.hasReceivedGameSetup = true;
          this.logger.log(
            `[INIT_REJOIN] Match ${compositeMatchId}: RESENT game_setup_ready to Player ${userId} (${username}).`,
          );
        } else {
          this.logger.error(
            `[INIT_REJOIN] Match ${compositeMatchId}: Could not RESEND game_setup_ready to rejoining Player ${userId} (${username}) - WS state: ${connectingPlayer.ws?.readyState}`,
          );
        }
      } else {
        this.logger.log(
          `[INIT_REJOIN] Match ${compositeMatchId}: Reconnecting Player ${userId} (${username}) had already received game_setup. Sending status update.`,
        );
        this.sendToClient(wsClient, 'status_update', {
          message: 'Rejoined ongoing game.',
        });
      }
    } else if (!opponentPlayer.isReadyForGameStart && opponentPlayer.id) {
      this.logger.log(
        `[INIT_REJOIN] User ${userId} - Match ${compositeMatchId}: Waiting for opponent ${opponentPlayer.name} (ID: ${opponentPlayer.id}) to join/reconnect.`,
      );
      this.sendToClient(wsClient, 'status_update', {
        message: `Connected. Waiting for ${opponentPlayer.name} to join/reconnect.`,
      });
    }
  }

  private onClientMessage(
    userId: number,
    compositeMatchId: string,
    data: RawData,
    client: WebSocket,
  ) {
    const matchState = this.activeMinesweeperMatches.get(compositeMatchId);
    if (!matchState || matchState.isMatchConcluded) {
      this.logger.warn(
        `[CLIENT_MSG] User ${userId} - Match ${compositeMatchId}: Message received for inactive/concluded match. Ignoring.`,
      );
      return;
    }

    const player =
      userId === matchState.player1.id
        ? matchState.player1
        : matchState.player2;
    const opponent =
      userId === matchState.player1.id
        ? matchState.player2
        : matchState.player1;

    try {
      const message = JSON.parse(data.toString());
      this.logger.log(
        `[CLIENT_MSG] User ${userId} - Match ${compositeMatchId}: Received: ${JSON.stringify(message)}`,
      );

      if (message.event === 'game_update') {
        const payload = message.payload;
        player.score = payload.score;
        player.timeTakenSeconds = payload.timeTakenSeconds;
        player.gameLostByBomb = payload.hitBomb;
        player.gameWonByClear = payload.clearedBoard;
        player.timedOutOrStillPlaying = false;
        player.gameEndTimeMs = Date.now();

        this.logger.log(
          `[CLIENT_MSG] User ${player.id} - Match ${compositeMatchId}: Player state updated: Score ${player.score}, Time ${player.timeTakenSeconds.toFixed(2)}s, Bomb ${player.gameLostByBomb}, Clear ${player.gameWonByClear}`,
        );

        if (opponent.ws) {
          this.sendToClient(opponent.ws, 'opponent_update', {
            opponentScore: player.score,
            opponentTimeTakenSeconds: player.timeTakenSeconds,
            opponentLostByBomb: player.gameLostByBomb,
            opponentWonByClear: player.gameWonByClear,
          });
          this.logger.log(
            `[CLIENT_MSG] User ${player.id} - Match ${compositeMatchId}: Sent opponent_update to ${opponent.id}.`,
          );
        }
        this.checkAndFinalizeMatch(matchState);
      } else {
        this.logger.warn(
          `[CLIENT_MSG] User ${userId} - Match ${compositeMatchId}: Unhandled event type '${message.event}'.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[CLIENT_MSG] User ${userId} - Match ${compositeMatchId}: Failed to parse message or handle event: ${data.toString()}`,
        error,
      );
    }
  }

  private handleMatchTimeout(matchState: MinesweeperMatchState) {
    if (matchState.isMatchConcluded) {
      this.logger.log(
        `[MATCH_TIMEOUT] Match ${matchState.compositeMatchId}: Already concluded, timeout handler aborted.`,
      );
      return;
    }
    this.logger.log(
      `[MATCH_TIMEOUT] Match ${matchState.compositeMatchId}: Handling match timeout.`,
    );

    const effectiveMatchEndTime =
      (matchState.matchStartTimeMs
        ? matchState.matchStartTimeMs
        : Date.now() - matchState.initialTimeSeconds * 1000) +
      matchState.initialTimeSeconds * 1000;

    if (matchState.player1.timedOutOrStillPlaying) {
      this.logger.log(
        `[MATCH_TIMEOUT] Match ${matchState.compositeMatchId}: Player 1 (${matchState.player1.id}) timed out or still playing. Marking as timed out.`,
      );
      matchState.player1.timedOutOrStillPlaying = true;
      matchState.player1.timeTakenSeconds = matchState.initialTimeSeconds;
      matchState.player1.gameEndTimeMs = effectiveMatchEndTime;
    }
    if (matchState.player2.timedOutOrStillPlaying) {
      this.logger.log(
        `[MATCH_TIMEOUT] Match ${matchState.compositeMatchId}: Player 2 (${matchState.player2.id}) timed out or still playing. Marking as timed out.`,
      );
      matchState.player2.timedOutOrStillPlaying = true;
      matchState.player2.timeTakenSeconds = matchState.initialTimeSeconds;
      matchState.player2.gameEndTimeMs = effectiveMatchEndTime;
    }
    this.checkAndFinalizeMatch(matchState);
  }

  private checkAndFinalizeMatch(matchState: MinesweeperMatchState) {
    const p1Finished =
      !matchState.player1.timedOutOrStillPlaying ||
      matchState.player1.gameEndTimeMs !== null;
    const p2Finished =
      !matchState.player2.timedOutOrStillPlaying ||
      matchState.player2.gameEndTimeMs !== null;
    this.logger.log(
      `[FINALIZE_CHECK] Match ${matchState.compositeMatchId}: P1 Finished: ${p1Finished}, P2 Finished: ${p2Finished}, Match Concluded Flag: ${matchState.isMatchConcluded}`,
    );

    if ((p1Finished && p2Finished) || matchState.isMatchConcluded) {
      if (!matchState.isMatchConcluded) {
        this.logger.log(
          `[FINALIZE_CHECK] Match ${matchState.compositeMatchId}: Conditions met to determine winner.`,
        );
        this.determineWinnerAndResolve(matchState);
      } else {
        this.logger.log(
          `[FINALIZE_CHECK] Match ${matchState.compositeMatchId}: Already marked as concluded, but check was run. This might happen if one player finishes then overall timer expires.`,
        );
      }
    } else {
      this.logger.log(
        `[FINALIZE_CHECK] Match ${matchState.compositeMatchId}: Not all players finished, match not yet concluded by other means.`,
      );
    }
  }

  private async determineWinnerAndResolve(
    matchState: MinesweeperMatchState,
    sendOnly = false,
  ) {
    if (matchState.isMatchConcluded && !sendOnly) {
      this.logger.log(
        `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: Already concluded and resolved. Aborting re-resolve.`,
      );
      return;
    }
    if (!sendOnly) {
      this.logger.log(
        `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: Setting isMatchConcluded = true.`,
      );
      matchState.isMatchConcluded = true;
      if (matchState.matchOverallTimer) {
        clearTimeout(matchState.matchOverallTimer);
        matchState.matchOverallTimer = null;
        this.logger.log(
          `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: Cleared overall match timer.`,
        );
      }
    } else {
      this.logger.log(
        `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: Send only mode (for rejoining concluded match).`,
      );
    }

    const p1 = matchState.player1;
    const p2 = matchState.player2;
    let winnerId: number | null = null;
    let reason = '';

    const maxPossibleScore =
      matchState.rows * matchState.cols - matchState.bombCount;
    if (p1.gameWonByClear) p1.score = maxPossibleScore;
    if (p2.gameWonByClear) p2.score = maxPossibleScore;

    this.logger.log(
      `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: P1 Score: ${p1.score}, P1 Time: ${p1.timeTakenSeconds}, P1 WonClear: ${p1.gameWonByClear}`,
    );
    this.logger.log(
      `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: P2 Score: ${p2.score}, P2 Time: ${p2.timeTakenSeconds}, P2 WonClear: ${p2.gameWonByClear}`,
    );

    if (p1.score > p2.score) {
      winnerId = p1.id;
      reason = `${p1.name} wins with a higher score!`;
    } else if (p2.score > p1.score) {
      winnerId = p2.id;
      reason = `${p2.name} wins with a higher score!`;
    } else {
      if (p1.timeTakenSeconds < p2.timeTakenSeconds) {
        winnerId = p1.id;
        reason = `${p1.name} wins on faster time with equal scores!`;
      } else if (p2.timeTakenSeconds < p1.timeTakenSeconds) {
        winnerId = p2.id;
        reason = `${p2.name} wins on faster time with equal scores!`;
      } else {
        winnerId = null;
        reason = "It's a perfect draw on score and time!";
      }
    }

    const finalScoreString = `P1 (${p1.name}): ${p1.score} pts, ${p1.timeTakenSeconds.toFixed(2)}s - P2 (${p2.name}): ${p2.score} pts, ${p2.timeTakenSeconds.toFixed(2)}s`;
    this.logger.log(
      `[DETERMINE_WINNER] Match ${matchState.compositeMatchId} Concluded. Winner: ${winnerId || 'Draw'}. Reason: ${reason}. Final Score: ${finalScoreString}`,
    );

    if (!sendOnly) {
      try {
        if (winnerId) {
          const loserId = winnerId === p1.id ? p2.id : p1.id;
          this.logger.log(
            `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: Calling MatchesService.resolveMatch. Winner: ${winnerId}, Loser: ${loserId}`,
          );
          await this.matchesService.resolveMatch(
            winnerId,
            loserId,
            matchState.stake,
            matchState.dbMatchId,
            finalScoreString,
            matchState.compositeMatchId,
          );
        } else {
          this.logger.log(
            `[DETERMINE_WINNER] Match ${matchState.compositeMatchId} (DB ${matchState.dbMatchId}): Is a draw. Calling MatchesService.resolveMatchAsDraw.`,
          );
          await this.matchesService.resolveMatchAsDraw(
            matchState.dbMatchId,
            matchState.stake,
            finalScoreString,
            matchState.compositeMatchId,
          );
        }
        this.logger.log(
          `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: DB resolution successful.`,
        );
      } catch (error) {
        this.logger.error(
          `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: Error resolving match ${matchState.dbMatchId} in DB:`,
          error,
        );
      }
    }

    const matchOverPayload = {
      matchId: matchState.compositeMatchId,
      winnerId,
      player1Results: {
        id: p1.id,
        name: p1.name,
        score: p1.score,
        timeTakenSeconds: p1.timeTakenSeconds,
        lostByBomb: p1.gameLostByBomb,
        wonByClear: p1.gameWonByClear,
      },
      player2Results: {
        id: p2.id,
        name: p2.name,
        score: p2.score,
        timeTakenSeconds: p2.timeTakenSeconds,
        lostByBomb: p2.gameLostByBomb,
        wonByClear: p2.gameWonByClear,
      },
      reason,
      finalScoreString,
    };
    if (p1.ws && p1.ws.readyState === WebSocket.OPEN) {
      this.sendToClient(p1.ws, 'match_over', matchOverPayload);
      this.logger.log(
        `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: Sent match_over to P1 (${p1.id}).`,
      );
    } else {
      this.logger.warn(
        `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: P1 (${p1.id}) WS not open or undefined. Cannot send match_over.`,
      );
    }
    if (p2.ws && p2.ws.readyState === WebSocket.OPEN) {
      this.sendToClient(p2.ws, 'match_over', matchOverPayload);
      this.logger.log(
        `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: Sent match_over to P2 (${p2.id}).`,
      );
    } else {
      this.logger.warn(
        `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: P2 (${p2.id}) WS not open or undefined. Cannot send match_over.`,
      );
    }

    if (!sendOnly) {
      this.activeMinesweeperMatches.delete(matchState.compositeMatchId);
      this.logger.log(
        `[DETERMINE_WINNER] Match ${matchState.compositeMatchId}: Cleaned up active match state from memory.`,
      );
    }
  }

  private async onClientDisconnect(
    userId: number,
    compositeMatchId: string,
    code: number,
    reason: string,
  ) {
    this.logger.log(
      `[DISCONNECT] UserID ${userId} - Match ${compositeMatchId}: MS WS disconnected. Code: ${code}, Reason: ${reason}.`,
    );
    const matchState = this.activeMinesweeperMatches.get(compositeMatchId);

    if (matchState && !matchState.isMatchConcluded) {
      this.logger.log(
        `[DISCONNECT] UserID ${userId} - Match ${compositeMatchId}: Disconnected during active game.`,
      );
      const disconnectedPlayer =
        userId === matchState.player1.id
          ? matchState.player1
          : matchState.player2;
      const opponentPlayer =
        userId === matchState.player1.id
          ? matchState.player2
          : matchState.player1;

      disconnectedPlayer.ws = undefined;
      disconnectedPlayer.isReadyForGameStart = false;
      this.logger.log(
        `[DISCONNECT] UserID ${userId} - Match ${compositeMatchId}: Marked as not ready, WS undefined.`,
      );

      if (opponentPlayer.ws) {
        this.logger.log(
          `[DISCONNECT] UserID ${userId} - Match ${compositeMatchId}: Opponent ${opponentPlayer.id} still connected. Notifying opponent and starting disconnect timer for ${disconnectedPlayer.name}.`,
        );
        this.sendToClient(opponentPlayer.ws, 'status_update', {
          message: `${disconnectedPlayer.name} disconnected. Waiting for reconnect (${PLAYER_RECONNECT_GRACE_PERIOD_MS / 1000}s)...`,
        });

        if (matchState.matchStartTimeMs && !disconnectedPlayer.gameEndTimeMs) {
          this.logger.log(
            `[DISCONNECT] UserID ${userId} - Match ${compositeMatchId}: Game was ongoing. Starting forfeit timer.`,
          );
          if (disconnectedPlayer.disconnectTimer)
            clearTimeout(disconnectedPlayer.disconnectTimer);
          disconnectedPlayer.disconnectTimer = setTimeout(async () => {
            this.logger.log(
              `[DISCONNECT_TIMER] UserID ${userId} - Match ${compositeMatchId}: Disconnect grace period EXPIRED for ${disconnectedPlayer.name}.`,
            );
            if (disconnectedPlayer.ws || matchState.isMatchConcluded) {
              this.logger.log(
                `[DISCONNECT_TIMER] UserID ${userId} - Match ${compositeMatchId}: Player reconnected or match already ended. No forfeit action.`,
              );
              return;
            }
            this.logger.log(
              `[DISCONNECT_TIMER] UserID ${userId} - Match ${compositeMatchId}: Player ${disconnectedPlayer.name} did not reconnect. Forfeiting.`,
            );

            disconnectedPlayer.score = -1;
            disconnectedPlayer.timeTakenSeconds = matchState.initialTimeSeconds;
            disconnectedPlayer.gameLostByBomb = true;
            disconnectedPlayer.timedOutOrStillPlaying = false;
            disconnectedPlayer.gameEndTimeMs = Date.now();

            opponentPlayer.gameWonByClear = true;
            if (!opponentPlayer.gameEndTimeMs) {
              const startTime = matchState.matchStartTimeMs;
              if (startTime) {
                opponentPlayer.timeTakenSeconds =
                  (Date.now() - startTime) / 1000;
              } else {
                opponentPlayer.timeTakenSeconds = 0.1;
                this.logger.warn(
                  `[DISCONNECT_TIMER] Match ${compositeMatchId}: Forfeited by ${disconnectedPlayer.name} but official server start time was null. Opponent ${opponentPlayer.name} wins.`,
                );
              }
              opponentPlayer.gameEndTimeMs = Date.now();
            }

            this.determineWinnerAndResolve(matchState);
          }, PLAYER_RECONNECT_GRACE_PERIOD_MS);
        } else {
          this.logger.log(
            `[DISCONNECT] UserID ${userId} - Match ${compositeMatchId}: Game not started or disconnected player already finished. No forfeit timer started.`,
          );
        }
      } else {
        this.logger.log(
          `[DISCONNECT] UserID ${userId} - Match ${compositeMatchId}: Opponent also not connected. Match might be abandoned if no one reconnects.`,
        );
      }
    } else if (matchState && matchState.isMatchConcluded) {
      this.logger.log(
        `[DISCONNECT] UserID ${userId} - Match ${compositeMatchId}: Disconnected after match was already concluded.`,
      );
    } else if (!matchState) {
      this.logger.log(
        `[DISCONNECT] UserID ${userId} - Match ${compositeMatchId}: No active match state found for this ID upon disconnect.`,
      );
    }
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log(
      `[GATEWAY] Client disconnected (generic handler). Further details should be in onClientDisconnect if it was a game participant.`,
    );
  }

  private sendToClient(
    client: WebSocket | undefined,
    event: string,
    data: any,
  ) {
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({ event, data }));
      } catch (error) {
        this.logger.error(
          `[SEND_CLIENT] Error sending WS message ('${event}') to client:`,
          error,
        );
      }
    } else {
      this.logger.warn(
        `[SEND_CLIENT] Attempted to send WS message ('${event}') but client undefined or not open. Client state: ${client?.readyState}`,
      );
    }
  }
}
