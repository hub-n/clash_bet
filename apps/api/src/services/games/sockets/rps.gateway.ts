import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket, RawData, WebSocket as WsSocketType } from 'ws';
import * as url from 'url';
import { MatchesService } from 'src/services/matches/matches.service';
import { MatchmakingService } from 'src/services/matches/matchmaking/matchmaking.service';

const ROUND_DURATION_SECONDS = 15;
const MAX_ROUND_WINS = 3;
const PLAYER_RECONNECT_GRACE_PERIOD_MS = 30000;

interface ActiveMatchDetailsFromMM {
  compositeMatchId: string;
  gameKey: string;
  betAmount: number;
  playerOne: { id: number | string; name: string };
  playerTwo: { id: number | string; name: string };
}

interface RPSPlayer {
  id: number;
  name: string;
  ws?: WsSocketType;
  disconnectTimer?: NodeJS.Timeout | null;
}

interface RPSMatchState {
  dbMatchId: number;
  compositeMatchId: string;
  gameKey: string;
  player1: RPSPlayer;
  player2: RPSPlayer;
  stake: number;
  scores: { player1: number; player2: number };
  currentRoundMoves: { [userId: number]: string | null };
  currentRoundPlayerStatus: {
    [userId: number]: 'pending' | 'played' | 'timed_out';
  };
  roundTimer: NodeJS.Timeout | null;
  isBo5Over: boolean;
}

@WebSocketGateway({
  path: '/api/rps/ws',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class RpsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private logger = new Logger('RpsGateway');
  private generalUserIdToWsMap: Map<number, WsSocketType> = new Map();
  private activeRpsMatches: Map<string, RPSMatchState> = new Map();

  constructor(
    private readonly matchesService: MatchesService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  async handleConnection(client: WsSocketType, ...args: any[]) {
    const request = args[0];
    const userSession = request.user;
    const userId = userSession?.UserID;
    const username = userSession?.Username;

    this.logger.log(
      `WS Connection attempt: UserID ${userId}, Username ${username}`,
    );

    if (!userId || !username) {
      this.logger.warn('WS Auth failed: UserID or Username missing. Closing.');
      client.close(1008, 'Not authenticated for WebSocket');
      return;
    }

    this.generalUserIdToWsMap.set(userId, client);
    this.logger.log(
      `User ${userId} (${username}) WS client stored. Total general: ${this.generalUserIdToWsMap.size}`,
    );

    const parsedUrl = url.parse(request.url || '', true);
    const compositeMatchId = parsedUrl.query.gameId as string;

    if (!compositeMatchId) {
      this.logger.warn(
        `User ${userId} connected to RPS WS without gameId. Closing.`,
      );
      client.close(1008, 'Game ID required for RPS session');
      return;
    }

    await this.initializeOrRejoinMatch(
      compositeMatchId,
      userId,
      username,
      client,
    );

    client.on('message', (data: RawData) =>
      this.onClientMessage(userId, data, client),
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
      this.logger.error(`WS Error (UserID ${userId}):`, error),
    );
  }

  private async initializeOrRejoinMatch(
    compositeMatchId: string,
    userId: number,
    username: string,
    wsClient: WsSocketType,
  ) {
    let matchState = this.activeRpsMatches.get(compositeMatchId);

    if (!matchState) {
      this.logger.log(
        `No RPS state for ${compositeMatchId}. Initializing or fetching DB state...`,
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
          `Failed to get valid matchmaking details for ${compositeMatchId}. Crucial property missing or invalid. Details: ${JSON.stringify(mmDetails)}`,
        );
        this.sendToClient(wsClient, 'error', {
          message: 'Game setup error: Incomplete match details from server.',
        });
        wsClient.close(
          1011,
          'Incomplete or invalid match details from matchmaking service',
        );
        return;
      }

      const p1IdFromMM = Number(mmDetails.playerOne.id);
      const p2IdFromMM = Number(mmDetails.playerTwo.id);

      if (isNaN(p1IdFromMM) || isNaN(p2IdFromMM)) {
        this.logger.error(
          `Invalid player IDs from matchmaking for ${compositeMatchId}: P1 ${mmDetails.playerOne.id}, P2 ${mmDetails.playerTwo.id}`,
        );
        this.sendToClient(wsClient, 'error', {
          message: 'Corrupted player ID in match details.',
        });
        wsClient.close(1011, 'Corrupted player ID in match details');
        return;
      }

      if (userId !== p1IdFromMM && userId !== p2IdFromMM) {
        this.logger.warn(
          `User ${userId} (${username}) not part of MM players for ${compositeMatchId} (P1: ${p1IdFromMM}, P2: ${p2IdFromMM}). Denying.`,
        );
        this.sendToClient(wsClient, 'error', {
          message: 'You are not authorized for this game session.',
        });
        wsClient.close(1008, 'User not part of game session');
        return;
      }

      try {
        const startMatchResult = await this.matchesService.startMatch(
          p1IdFromMM,
          p2IdFromMM,
          mmDetails.betAmount,
          mmDetails.gameKey,
          compositeMatchId,
        );
        this.logger.log(
          `MatchesService.startMatch for ${compositeMatchId}: DB MatchID ${startMatchResult.matchId}, Existed: ${startMatchResult.alreadyExisted}`,
        );

        matchState = this.activeRpsMatches.get(compositeMatchId);
        if (matchState) {
          this.logger.log(
            `Concurrent init for ${compositeMatchId}, state already in memory.`,
          );
        } else {
          matchState = {
            dbMatchId: startMatchResult.matchId,
            compositeMatchId,
            gameKey: mmDetails.gameKey,
            player1: {
              id: p1IdFromMM,
              name: mmDetails.playerOne.name,
              disconnectTimer: null,
            },
            player2: {
              id: p2IdFromMM,
              name: mmDetails.playerTwo.name,
              disconnectTimer: null,
            },
            stake: mmDetails.betAmount,
            scores: { player1: 0, player2: 0 },
            currentRoundMoves: { [p1IdFromMM]: null, [p2IdFromMM]: null },
            currentRoundPlayerStatus: {
              [p1IdFromMM]: 'pending',
              [p2IdFromMM]: 'pending',
            },
            roundTimer: null,
            isBo5Over: false,
          };

          if (startMatchResult.alreadyExisted) {
            this.logger.log(
              `Match ${compositeMatchId} (DB ${startMatchResult.matchId}) existed. Loading score/state.`,
            );
            const dbMatchRecord = await this.matchesService.getMatchById(
              startMatchResult.matchId,
            );
            if (dbMatchRecord) {
              if (dbMatchRecord.MatchState === 'COMPLETED')
                matchState.isBo5Over = true;
              if (dbMatchRecord.Score) {
                const scoreParts = dbMatchRecord.Score.match(/(\d+)-(\d+)/);
                if (scoreParts && scoreParts.length === 3) {
                  if (dbMatchRecord.PlayerOneID === matchState.player1.id) {
                    matchState.scores.player1 = parseInt(scoreParts[1], 10);
                    matchState.scores.player2 = parseInt(scoreParts[2], 10);
                  } else {
                    matchState.scores.player2 = parseInt(scoreParts[1], 10);
                    matchState.scores.player1 = parseInt(scoreParts[2], 10);
                  }
                }
              }
              this.logger.log(
                `Loaded state for DB ${startMatchResult.matchId}: Scores P1=${matchState.scores.player1}, P2=${matchState.scores.player2}, Over=${matchState.isBo5Over}`,
              );
            } else {
              this.logger.warn(
                `Could not load DB record for existing match DB ID ${startMatchResult.matchId}.`,
              );
            }
          }
          this.activeRpsMatches.set(compositeMatchId, matchState);
          this.logger.log(
            `RPS Match state for ${compositeMatchId} (DB ${matchState.dbMatchId}) now in memory.`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Critical error during game init for ${compositeMatchId}:`,
          error.message,
          error.stack,
        );
        this.sendToClient(wsClient, 'error', {
          message: 'Server error: Failed to initialize game session.',
        });
        wsClient.close(1011, 'Server game session initialization error');
        return;
      }
    }

    const connectingPlayerObject =
      userId === matchState.player1.id
        ? matchState.player1
        : matchState.player2;
    const opponentPlayerObject =
      userId === matchState.player1.id
        ? matchState.player2
        : matchState.player1;

    connectingPlayerObject.ws = wsClient;
    if (connectingPlayerObject.disconnectTimer) {
      clearTimeout(connectingPlayerObject.disconnectTimer);
      connectingPlayerObject.disconnectTimer = null;
      this.logger.log(
        `Player ${userId} (${username}) reconnected to ${compositeMatchId} within grace period. Disconnect timer cleared.`,
      );
      if (opponentPlayerObject.ws) {
        this.sendToClient(opponentPlayerObject.ws, 'status_update', {
          message: `${username} has reconnected.`,
        });
      }
    } else {
      this.logger.log(
        `Player ${userId} (${username}) connected to ${compositeMatchId}.`,
      );
    }

    if (matchState.isBo5Over) {
      this.sendMatchOverStateToClient(
        wsClient,
        matchState,
        'This Best of 5 match has already concluded.',
      );
      return;
    }

    this.sendToClient(wsClient, 'game_state_update', {
      matchId: compositeMatchId,
      player1Name: matchState.player1.name,
      player2Name: matchState.player2.name,
      overallScores: matchState.scores,
      currentRoundNumber:
        matchState.scores.player1 + matchState.scores.player2 + 1,
    });
    this.logger.log(
      `Sent 'game_state_update' to UserID ${userId} for ${compositeMatchId}.`,
    );

    if (
      matchState.player1.ws &&
      matchState.player2.ws &&
      !matchState.isBo5Over
    ) {
      const roundInProgress = Object.values(
        matchState.currentRoundPlayerStatus,
      ).some((s) => s === 'pending');
      if (matchState.roundTimer && roundInProgress) {
        this.logger.log(
          `Both players connected for ${compositeMatchId}. Round timer active. Resending new_round info.`,
        );
        const currentRoundNumber =
          matchState.scores.player1 + matchState.scores.player2 + 1;
        this.broadcastToMatchPlayers(matchState, 'new_round', {
          matchId: compositeMatchId,
          overallScores: matchState.scores,
          roundNumber: currentRoundNumber,
          timerDuration: ROUND_DURATION_SECONDS,
        });
      } else if (!matchState.roundTimer && roundInProgress) {
        this.logger.log(
          `Both players now connected for ${compositeMatchId}. Round was pending, no timer. Starting new round logic.`,
        );
        this.startNewRound(matchState);
      } else if (!roundInProgress && !matchState.roundTimer) {
        this.logger.log(
          `Both players connected for ${compositeMatchId}. No round active. Triggering BO5 check.`,
        );
        this.checkAndHandleBo5Completion(matchState);
      }
    } else if (
      !matchState.isBo5Over &&
      !(userId === matchState.player1.id
        ? matchState.player2.ws
        : matchState.player1.ws)
    ) {
      this.sendToClient(wsClient, 'status_update', {
        message: `Connected. Waiting for opponent, ${opponentPlayerObject.name}, to join/reconnect.`,
      });
    }
  }

  private onClientMessage(userId: number, data: RawData, client: WsSocketType) {
    try {
      const message = JSON.parse(data.toString());
      this.logger.log(
        `Message from UserID ${userId}: ${JSON.stringify(message)}`,
      );
      const { event, payload } = message;
      const compositeMatchId = payload?.matchId;

      if (!compositeMatchId) {
        this.sendToClient(client, 'error', {
          message: 'Client message missing matchId.',
        });
        return;
      }
      const matchState = this.activeRpsMatches.get(compositeMatchId);
      if (!matchState) {
        this.sendToClient(client, 'error', {
          message: `Game session ${compositeMatchId} not found or inactive.`,
        });
        return;
      }

      if (matchState.isBo5Over) {
        this.sendMatchOverStateToClient(
          client,
          matchState,
          'Match has already concluded.',
        );
        return;
      }

      const playerObject =
        userId === matchState.player1.id
          ? matchState.player1
          : matchState.player2;
      if (!playerObject.ws) {
        this.logger.warn(
          `Message from UserID ${userId} for ${compositeMatchId}, but their WS is not currently associated in matchState. Likely a reconnect race. Ignoring.`,
        );
        return;
      }

      if (event === 'play') {
        this.handlePlayEvent(userId, payload.move, matchState, client);
      } else {
        this.logger.warn(`Unhandled event '${event}' from UserID ${userId}.`);
        this.sendToClient(client, 'error', {
          message: `Unknown event type: ${event}`,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to parse message from UserID ${userId} or handle event: ${data.toString()}`,
        error,
      );
      this.sendToClient(client, 'error', {
        message: 'Invalid message format from client.',
      });
    }
  }

  private handlePlayEvent(
    userId: number,
    move: string,
    matchState: RPSMatchState,
    client: WsSocketType,
  ) {
    if (!move || typeof move !== 'string') {
      this.sendToClient(client, 'error', {
        message: 'Invalid or missing move in play event.',
      });
      return;
    }
    if (matchState.currentRoundPlayerStatus[userId] === 'played') {
      this.sendToClient(client, 'error', {
        message: 'You have already submitted a move for this round.',
      });
      return;
    }
    if (matchState.currentRoundPlayerStatus[userId] !== 'pending') {
      this.sendToClient(client, 'error', {
        message:
          'Cannot make a move at this time (your status is not pending).',
      });
      return;
    }
    if (!matchState.player1.ws || !matchState.player2.ws) {
      this.sendToClient(client, 'error', {
        message: 'Cannot play move, opponent not currently connected.',
      });
      this.logger.warn(
        `Play event from ${userId} for ${matchState.compositeMatchId} but opponent WS is missing.`,
      );
      return;
    }
    if (!matchState.roundTimer) {
      this.sendToClient(client, 'error', {
        message: 'The round is not currently active or has already timed out.',
      });
      this.logger.warn(
        `Play event from ${userId} for ${matchState.compositeMatchId} but no roundTimer is active.`,
      );
      return;
    }

    matchState.currentRoundMoves[userId] = move;
    matchState.currentRoundPlayerStatus[userId] = 'played';
    this.logger.log(
      `UserID ${userId} played '${move}' in ${matchState.compositeMatchId}.`,
    );

    const opponent =
      userId === matchState.player1.id
        ? matchState.player2
        : matchState.player1;
    if (opponent.ws) {
      this.sendToClient(opponent.ws, 'opponent_played', {
        matchId: matchState.compositeMatchId,
      });
    }

    if (
      matchState.currentRoundPlayerStatus[matchState.player1.id] === 'played' &&
      matchState.currentRoundPlayerStatus[matchState.player2.id] === 'played'
    ) {
      if (matchState.roundTimer) clearTimeout(matchState.roundTimer);
      matchState.roundTimer = null;
      this.processRoundOutcome(matchState);
    }
  }

  private startNewRound(matchState: RPSMatchState) {
    if (matchState.isBo5Over) {
      this.logger.log(
        `startNewRound called for ${matchState.compositeMatchId}, but BO5 is over. No new round.`,
      );
      return;
    }
    if (!matchState.player1.ws || !matchState.player2.ws) {
      this.logger.log(
        `startNewRound for ${matchState.compositeMatchId} aborted: one or both players not connected.`,
      );
      const connectedPlayer = matchState.player1.ws
        ? matchState.player1
        : matchState.player2.ws
          ? matchState.player2
          : null;
      const disconnectedPlayerName = matchState.player1.ws
        ? matchState.player2.name
        : matchState.player1.name;
      if (connectedPlayer?.ws) {
        this.sendToClient(connectedPlayer.ws, 'status_update', {
          message: `Waiting for ${disconnectedPlayerName} to reconnect before starting next round.`,
        });
      }
      return;
    }

    const roundNumber =
      matchState.scores.player1 + matchState.scores.player2 + 1;
    this.logger.log(
      `Starting Round ${roundNumber} for ${matchState.compositeMatchId}. Scores: P1 ${matchState.scores.player1}-${matchState.scores.player2} P2`,
    );

    matchState.currentRoundMoves = {
      [matchState.player1.id]: null,
      [matchState.player2.id]: null,
    };
    matchState.currentRoundPlayerStatus = {
      [matchState.player1.id]: 'pending',
      [matchState.player2.id]: 'pending',
    };

    if (matchState.roundTimer) clearTimeout(matchState.roundTimer);
    matchState.roundTimer = setTimeout(() => {
      this.logger.log(
        `Round timer EXPIRED for ${matchState.compositeMatchId}.`,
      );
      this.handleRoundTimeout(matchState);
    }, ROUND_DURATION_SECONDS * 1000);

    this.broadcastToMatchPlayers(matchState, 'new_round', {
      matchId: matchState.compositeMatchId,
      overallScores: matchState.scores,
      roundNumber,
      timerDuration: ROUND_DURATION_SECONDS,
    });
  }

  private handleRoundTimeout(matchState: RPSMatchState) {
    if (
      !matchState.roundTimer &&
      !Object.values(matchState.currentRoundPlayerStatus).some(
        (s) => s === 'pending',
      )
    ) {
      this.logger.warn(
        `handleRoundTimeout for ${matchState.compositeMatchId}: Timer already null and no pending players. Likely already processed.`,
      );
      return;
    }
    if (matchState.isBo5Over) return;

    if (matchState.roundTimer) clearTimeout(matchState.roundTimer);
    matchState.roundTimer = null;

    let roundWinnerId: number | null = null;
    let reason = '';

    if (
      matchState.currentRoundPlayerStatus[matchState.player1.id] === 'pending'
    ) {
      matchState.currentRoundPlayerStatus[matchState.player1.id] = 'timed_out';
    }
    if (
      matchState.currentRoundPlayerStatus[matchState.player2.id] === 'pending'
    ) {
      matchState.currentRoundPlayerStatus[matchState.player2.id] = 'timed_out';
    }

    const p1FinalStatus =
      matchState.currentRoundPlayerStatus[matchState.player1.id];
    const p2FinalStatus =
      matchState.currentRoundPlayerStatus[matchState.player2.id];

    if (p1FinalStatus === 'played' && p2FinalStatus === 'timed_out') {
      matchState.scores.player1++;
      roundWinnerId = matchState.player1.id;
      reason = `${matchState.player2.name} did not make a move in time.`;
    } else if (p2FinalStatus === 'played' && p1FinalStatus === 'timed_out') {
      matchState.scores.player2++;
      roundWinnerId = matchState.player2.id;
      reason = `${matchState.player1.name} did not make a move in time.`;
    } else if (p1FinalStatus === 'timed_out' && p2FinalStatus === 'timed_out') {
      reason = 'Both players timed out. The round is a draw.';
    } else if (p1FinalStatus === 'played' && p2FinalStatus === 'played') {
      this.logger.warn(
        `handleRoundTimeout for ${matchState.compositeMatchId}: Both players had 'played' status. Resolving based on moves.`,
      );
      this.processRoundOutcome(matchState);
      return;
    } else {
      reason = 'Round ended due to time limit.';
    }

    this.logger.log(
      `Round Timeout Result (${matchState.compositeMatchId}): Winner ${roundWinnerId || 'None (Draw)'}. Reason: ${reason}. Scores: P1 ${matchState.scores.player1}-${matchState.scores.player2} P2`,
    );
    this.broadcastToMatchPlayers(matchState, 'round_result', {
      matchId: matchState.compositeMatchId,
      moves: matchState.currentRoundMoves,
      roundWinnerId,
      overallScores: matchState.scores,
      reason,
    });
    this.checkAndHandleBo5Completion(matchState);
  }

  private processRoundOutcome(matchState: RPSMatchState) {
    if (matchState.isBo5Over) return;

    const p1Move = matchState.currentRoundMoves[matchState.player1.id];
    const p2Move = matchState.currentRoundMoves[matchState.player2.id];

    if (!p1Move || !p2Move) {
      this.logger.error(
        `processRoundOutcome for ${matchState.compositeMatchId} called prematurely: P1 Move: ${p1Move}, P2 Move: ${p2Move}. Player Status P1: ${matchState.currentRoundPlayerStatus[matchState.player1.id]}, P2: ${matchState.currentRoundPlayerStatus[matchState.player2.id]}`,
      );
      this.broadcastToMatchPlayers(matchState, 'error', {
        message:
          'Server error determining round result. Please wait for next round.',
      });
      this.checkAndHandleBo5Completion(matchState);
      return;
    }

    const result = this.getResultLogic(p1Move, p2Move);
    let roundWinnerId: number | null = null;
    let reason = '';

    if (result === 'p1_wins') {
      matchState.scores.player1++;
      roundWinnerId = matchState.player1.id;
      reason = `${matchState.player1.name} wins the round! (${p1Move} beats ${p2Move})`;
    } else if (result === 'p2_wins') {
      matchState.scores.player2++;
      roundWinnerId = matchState.player2.id;
      reason = `${matchState.player2.name} wins the round! (${p2Move} beats ${p1Move})`;
    } else {
      reason = `Round is a draw! (Both played ${p1Move})`;
    }

    this.logger.log(
      `Round Resolved (${matchState.compositeMatchId}): P1 (${p1Move}) vs P2 (${p2Move}). Winner: ${roundWinnerId || 'Draw'}. Scores: P1 ${matchState.scores.player1}-${matchState.scores.player2} P2`,
    );
    this.broadcastToMatchPlayers(matchState, 'round_result', {
      matchId: matchState.compositeMatchId,
      moves: matchState.currentRoundMoves,
      roundWinnerId,
      overallScores: matchState.scores,
      reason,
    });
    this.checkAndHandleBo5Completion(matchState);
  }

  private async checkAndHandleBo5Completion(matchState: RPSMatchState) {
    if (matchState.isBo5Over) return;

    if (
      matchState.scores.player1 >= MAX_ROUND_WINS ||
      matchState.scores.player2 >= MAX_ROUND_WINS
    ) {
      matchState.isBo5Over = true;
      if (matchState.roundTimer) clearTimeout(matchState.roundTimer);
      matchState.roundTimer = null;

      const winner =
        matchState.scores.player1 >= MAX_ROUND_WINS
          ? matchState.player1
          : matchState.player2;
      const loser =
        winner.id === matchState.player1.id
          ? matchState.player2
          : matchState.player1;
      const finalScoreString = `${matchState.scores.player1}-${matchState.scores.player2}`;

      this.logger.log(
        `BO5 Match ${matchState.compositeMatchId} (DB: ${matchState.dbMatchId}) COMPLETED. Winner: ${winner.name} (ID: ${winner.id}). Score: ${finalScoreString}`,
      );

      try {
        await this.matchesService.resolveMatch(
          winner.id,
          loser.id,
          matchState.stake,
          matchState.dbMatchId,
          finalScoreString,
        );
        this.logger.log(
          `DB Match ${matchState.dbMatchId} final state successfully saved.`,
        );
      } catch (error) {
        this.logger.error(
          `Error saving final state for DB Match ${matchState.dbMatchId}:`,
          error.message,
          error.stack,
        );
      }

      const matchOverMessage = `${winner.name} wins the Best of 5 match! Final Score: ${finalScoreString}.`;
      this.sendMatchOverStateToBothPlayers(matchState, matchOverMessage);
    } else {
      this.logger.log(
        `BO5 for ${matchState.compositeMatchId} not over. Scheduling next round.`,
      );
      setTimeout(() => this.startNewRound(matchState), 3000);
    }
  }

  private async onClientDisconnect(
    userId: number,
    compositeMatchId: string | undefined,
    code: number,
    reason: string,
  ) {
    this.logger.log(
      `UserID ${userId} WS disconnected. Code: ${code}, Reason: ${reason}.`,
    );
    this.generalUserIdToWsMap.delete(userId);

    if (!compositeMatchId) {
      this.logger.warn(
        `UserID ${userId} disconnected without compositeMatchId for game cleanup.`,
      );
      return;
    }

    const matchState = this.activeRpsMatches.get(compositeMatchId);
    if (matchState && !matchState.isBo5Over) {
      this.logger.log(
        `Player ${userId} (from match ${compositeMatchId}) disconnected during active game.`,
      );

      const disconnectedPlayerObject =
        userId === matchState.player1.id
          ? matchState.player1
          : matchState.player2;
      const opponentPlayerObject =
        userId === matchState.player1.id
          ? matchState.player2
          : matchState.player1;

      disconnectedPlayerObject.ws = undefined;

      if (
        opponentPlayerObject.ws &&
        this.generalUserIdToWsMap.has(opponentPlayerObject.id)
      ) {
        this.logger.log(
          `Opponent ${opponentPlayerObject.name} still connected to ${compositeMatchId}. Starting disconnect timer for ${disconnectedPlayerObject.name}.`,
        );
        this.sendToClient(opponentPlayerObject.ws, 'status_update', {
          message: `${disconnectedPlayerObject.name} disconnected. Waiting for reconnect (${PLAYER_RECONNECT_GRACE_PERIOD_MS / 1000}s)...`,
        });

        if (matchState.roundTimer) {
          clearTimeout(matchState.roundTimer);
          matchState.roundTimer = null;
          this.logger.log(
            `Round timer for ${compositeMatchId} paused due to disconnect by ${userId}.`,
          );
          this.sendToClient(opponentPlayerObject.ws, 'status_update', {
            message: `Round paused. ${disconnectedPlayerObject.name} disconnected.`,
          });
        }

        if (disconnectedPlayerObject.disconnectTimer)
          clearTimeout(disconnectedPlayerObject.disconnectTimer);
        disconnectedPlayerObject.disconnectTimer = setTimeout(async () => {
          this.logger.log(
            `Disconnect grace period expired for ${disconnectedPlayerObject.name} (UserID: ${userId}) in match ${compositeMatchId}.`,
          );
          disconnectedPlayerObject.disconnectTimer = null;

          if (disconnectedPlayerObject.ws) {
            this.logger.log(
              `Player ${userId} reconnected just as grace period timer fired. No forfeit.`,
            );
            return;
          }

          if (matchState.isBo5Over) return;

          this.logger.log(
            `Match ${compositeMatchId} (DB ID: ${matchState.dbMatchId}) forfeited by UserID ${userId}. Winner: ${opponentPlayerObject.name}.`,
          );
          matchState.isBo5Over = true;

          if (opponentPlayerObject.id === matchState.player1.id)
            matchState.scores.player1 = MAX_ROUND_WINS;
          else matchState.scores.player2 = MAX_ROUND_WINS;

          const finalScoreString = `${matchState.scores.player1}-${matchState.scores.player2} (Forfeit by ${disconnectedPlayerObject.name})`;
          try {
            await this.matchesService.resolveMatch(
              opponentPlayerObject.id,
              userId,
              matchState.stake,
              matchState.dbMatchId,
              finalScoreString,
            );
            this.logger.log(
              `Forfeited DB Match ${matchState.dbMatchId} saved.`,
            );
          } catch (error) {
            this.logger.error(
              `Error saving forfeited DB Match ${matchState.dbMatchId}:`,
              error.message,
              error.stack,
            );
          }
          this.sendMatchOverStateToClient(
            opponentPlayerObject.ws,
            matchState,
            `${opponentPlayerObject.name} wins by forfeit: ${disconnectedPlayerObject.name} did not reconnect.`,
          );
        }, PLAYER_RECONNECT_GRACE_PERIOD_MS);
      } else {
        this.logger.log(
          `UserID ${userId} disconnected from ${compositeMatchId}, but other player (${opponentPlayerObject.name}) also not actively connected. Match may become abandoned.`,
        );
        if (matchState.roundTimer) {
          clearTimeout(matchState.roundTimer);
          matchState.roundTimer = null;
        }
      }
    } else if (matchState && matchState.isBo5Over) {
      this.logger.log(
        `UserID ${userId} disconnected from ${compositeMatchId}, but match was already over.`,
      );
    }
  }

  private sendMatchOverStateToClient(
    client: WsSocketType | undefined,
    matchState: RPSMatchState,
    message: string,
  ) {
    if (!client || client.readyState !== WebSocket.OPEN) return;
    const winner =
      matchState.scores.player1 >= MAX_ROUND_WINS
        ? matchState.player1
        : matchState.player2;
    this.sendToClient(client, 'match_over', {
      matchId: matchState.compositeMatchId,
      winnerId: winner.id,
      winnerName: winner.name,
      finalScores: matchState.scores,
      message: message,
    });
  }
  private sendMatchOverStateToBothPlayers(
    matchState: RPSMatchState,
    message: string,
  ) {
    this.sendMatchOverStateToClient(matchState.player1.ws, matchState, message);
    this.sendMatchOverStateToClient(matchState.player2.ws, matchState, message);
  }

  private sendToClient(
    client: WsSocketType | undefined,
    event: string,
    data: any,
  ) {
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({ event, data }));
      } catch (error) {
        this.logger.error(
          `Error sending WS message ('${event}') to client:`,
          error,
        );
      }
    }
  }

  private broadcastToMatchPlayers(
    matchState: RPSMatchState,
    event: string,
    data: any,
  ) {
    this.logger.debug(
      `Broadcasting to ${matchState.compositeMatchId} ('${event}'): ${JSON.stringify(data)}`,
    );
    if (matchState.player1.ws)
      this.sendToClient(matchState.player1.ws, event, data);
    if (matchState.player2.ws)
      this.sendToClient(matchState.player2.ws, event, data);
  }

  private getResultLogic(
    move1: string,
    move2: string,
  ): 'p1_wins' | 'p2_wins' | 'draw' {
    if (move1 === move2) return 'draw';
    if (
      (move1 === 'rock' && move2 === 'scissors') ||
      (move1 === 'paper' && move2 === 'rock') ||
      (move1 === 'scissors' && move2 === 'paper')
    )
      return 'p1_wins';
    return 'p2_wins';
  }

  handleDisconnect(clientWs: WsSocketType) {}
}
