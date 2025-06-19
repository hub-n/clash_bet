import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Lobby } from '../interfaces/lobby.interface';
import { MatchesService } from '../matches.service';
import { UsersService } from 'src/users/users.service';
import { randomUUID } from 'crypto';
import { MatchmakingGateway } from '../sockets/matchmaking.gateway';

const GAME_TYPE_ID_TO_KEY: Record<number, string> = {
  1: 'rock-paper-scissors',
  2: 'battleships',
  3: 'minesweeper',
};

export interface PlayerDetails {
  id: number;
  name: string;
}

export interface ActiveMatchDetailsFromMM {
  compositeMatchId: string;
  gameKey: string;
  betAmount: number;
  playerOne: PlayerDetails;
  playerTwo: PlayerDetails;
  actualUuid: string;
}

function getGameKeyFromId(gameTypeID: number): string {
  const key = GAME_TYPE_ID_TO_KEY[gameTypeID];
  if (!key) {
    console.error(
      `[MatchmakingService] getGameKeyFromId: No string key found for numeric gameTypeID: ${gameTypeID}. Returning 'unknown-game'.`,
    );
    return 'unknown-game';
  }
  return key;
}

function parseCompositeMatchId(
  compositeId: string,
): { gameKey: string; betAmount: number; actualUuid: string } | null {
  const uuidSeparator = '-uuid-';
  const idParts = compositeId.split(uuidSeparator);
  if (idParts.length !== 2 || !idParts[0] || !idParts[1]) {
    return null;
  }
  const gameInfoSegment = idParts[0];
  const actualUuid = idParts[1];
  const gameInfoParts = gameInfoSegment.split('-');
  if (gameInfoParts.length < 2) return null;

  const betAmountStr = gameInfoParts.pop();
  if (betAmountStr === undefined) return null;

  const betAmount = parseInt(betAmountStr);
  if (isNaN(betAmount)) return null;

  const gameKey = gameInfoParts.join('-');
  if (!gameKey) return null;

  return { gameKey, betAmount, actualUuid };
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private lobbies: Map<number, Lobby[]> = new Map();
  private activeMatches: Map<string, ActiveMatchDetailsFromMM> = new Map();
  private readonly MATCH_TIMEOUT_TIME_MS = 60000;

  constructor(
    private readonly matchesService: MatchesService,
    private usersService: UsersService,
    private matchmakingGateway: MatchmakingGateway,
  ) {}

  async findOrCreate(
    playerID: number,
    gameTypeID: number,
    targetFee: number,
    feeRange: number,
  ) {
    const minFee = targetFee - feeRange;
    const maxFee = targetFee + feeRange;
    const gameLobbies = this.lobbies.get(gameTypeID) || [];
    this.logger.log(
      `[Service findOrCreate] Searching for match for player ${playerID}, gameTypeID ${gameTypeID}, targetFee ${targetFee} +/- ${feeRange}. Found ${gameLobbies.length} existing lobbies for this gameTypeID.`,
    );

    const existingLobbyForPlayer = gameLobbies.find(
      (lobby) => lobby.CreatorID === playerID,
    );
    if (existingLobbyForPlayer) {
      this.logger.log(
        `[Service findOrCreate] Player ${playerID} is already waiting in room ${existingLobbyForPlayer.MatchID} for game type ${gameTypeID}.`,
      );
      return {
        status: 'already_waiting',
        room: existingLobbyForPlayer,
        message: 'You are already in a waiting room for this game type.',
      };
    }

    const availableRooms = gameLobbies.filter(
      (room) =>
        room.Fee >= minFee && room.Fee <= maxFee && room.CreatorID !== playerID,
    );
    this.logger.log(
      `[Service findOrCreate] Found ${availableRooms.length} potentially compatible rooms for player ${playerID}.`,
    );

    const playerBalance = await this.usersService.getBalance(playerID);

    for (const room of availableRooms) {
      this.logger.log(
        `[Service findOrCreate] Checking room ${room.MatchID} (Fee: ${room.Fee}) created by ${room.CreatorID}. Player ${playerID} balance: ${playerBalance.balance}`,
      );
      if (playerBalance.balance >= room.Fee) {
        const creatorBalance = await this.usersService.getBalance(
          room.CreatorID,
        );
        this.logger.log(
          `[Service findOrCreate] Creator ${room.CreatorID} balance: ${creatorBalance.balance}`,
        );
        if (creatorBalance.balance >= room.Fee) {
          this.logger.log(
            `[Service findOrCreate] Player ${playerID} found matching room ${room.MatchID} created by ${room.CreatorID} with fee ${room.Fee}.`,
          );
          return this.handleRoomJoin(playerID, room);
        } else {
          this.logger.warn(
            `[Service findOrCreate] Creator ${room.CreatorID} of room ${room.MatchID} can no longer afford the fee ${room.Fee}. Skipping room.`,
          );
        }
      } else {
        this.logger.warn(
          `[Service findOrCreate] Player ${playerID} cannot afford fee ${room.Fee} for room ${room.MatchID}. Skipping room.`,
        );
      }
    }

    this.logger.log(
      `[Service findOrCreate] No suitable room found for player ${playerID} (fee ${targetFee} +/-${feeRange}) for gameTypeID ${gameTypeID}. Creating new room.`,
    );
    if (playerBalance.balance < targetFee) {
      this.logger.error(
        `[Service findOrCreate] Player ${playerID} has insufficient balance (${playerBalance.balance}) to create room with targetFee ${targetFee}.`,
      );
      throw new HttpException(
        'Insufficient balance to create this room.',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.createNewRoom(playerID, gameTypeID, targetFee);
  }

  private async handleRoomJoin(playerID: number, room: Lobby) {
    const updatedLobbies = (this.lobbies.get(room.GameTypeID) || []).filter(
      (r) => r.MatchID !== room.MatchID,
    );
    this.lobbies.set(room.GameTypeID, updatedLobbies);

    const playerOneId = room.CreatorID;
    const playerTwoId = playerID;

    const playerOneData = await this.usersService.findByID(playerOneId);
    const playerTwoData = await this.usersService.findByID(playerTwoId);

    if (!playerOneData || !playerTwoData) {
      this.logger.error(
        `[Service handleRoomJoin] Could not retrieve details for one or both players: P1 ID ${playerOneId}, P2 ID ${playerTwoId}.`,
      );
      throw new HttpException(
        'Failed to retrieve player details.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const parsedIdDetails = parseCompositeMatchId(room.MatchID);
    if (!parsedIdDetails) {
      this.logger.error(
        `[Service handleRoomJoin] Could not parse compositeMatchId: ${room.MatchID}`,
      );
      throw new HttpException(
        'Internal error parsing match ID.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const { gameKey, betAmount, actualUuid } = parsedIdDetails;

    const activeMatch: ActiveMatchDetailsFromMM = {
      compositeMatchId: room.MatchID,
      gameKey: gameKey,
      betAmount: betAmount,
      playerOne: { id: playerOneData.UserID, name: playerOneData.Username },
      playerTwo: { id: playerTwoData.UserID, name: playerTwoData.Username },
      actualUuid: actualUuid,
    };
    this.activeMatches.set(room.MatchID, activeMatch);
    this.logger.log(
      `[Service handleRoomJoin] Stored active match: ${JSON.stringify(activeMatch)}`,
    );

    this.logger.log(
      `[Service handleRoomJoin] Match created: ${room.MatchID} between ${playerOneId} and ${playerTwoId} for game ${room.GameTypeID}. Fee: ${room.Fee}`,
    );

    const matchPayload = {
      GameTypeID: room.GameTypeID,
      PlayerOneID: playerOneId,
      PlayerTwoID: playerTwoId,
      EntryFee: room.Fee,
      MatchID: room.MatchID,
      PlayerOneUsername: playerOneData.Username,
      PlayerTwoUsername: playerTwoData.Username,
    };

    this.matchmakingGateway.sendToUser(
      playerOneId,
      'match_found',
      matchPayload,
    );
    this.matchmakingGateway.sendToUser(
      playerTwoId,
      'match_found',
      matchPayload,
    );
    this.logger.log(
      `[Service handleRoomJoin] Sent 'match_found' with MatchID: ${matchPayload.MatchID} to players. P1: ${playerOneData.Username}, P2: ${playerTwoData.Username}`,
    );

    return {
      status: 'matched',
      match: matchPayload,
      message: 'Match successfully created!',
    };
  }

  private async createNewRoom(
    playerID: number,
    gameTypeID: number,
    targetFee: number,
  ) {
    const gameKey = getGameKeyFromId(gameTypeID);
    this.logger.log(
      `[Service createNewRoom] Received numeric gameTypeID: ${gameTypeID}, resolved to gameKey: '${gameKey}'`,
    );

    const actualUuid = randomUUID();
    const compositeMatchID = `${gameKey}-${targetFee}-uuid-${actualUuid}`;

    const newRoom: Lobby = {
      MatchID: compositeMatchID,
      GameTypeID: gameTypeID,
      CreatorID: playerID,
      Fee: targetFee,
      CreatedAt: new Date(),
    };

    this.lobbies.set(gameTypeID, [
      ...(this.lobbies.get(gameTypeID) || []),
      newRoom,
    ]);

    this.logger.log(
      `[Service createNewRoom] Player ${playerID} created new room ${newRoom.MatchID} (using gameKey '${gameKey}') for numeric gameTypeID ${gameTypeID} with fee ${targetFee}.`,
    );

    return {
      status: 'waiting',
      room: newRoom,
      message: 'No suitable match found. Created a new waiting room for you.',
    };
  }

  public getLobbies() {
    const publicLobbies: { [gameTypeId: number]: Omit<Lobby, ''>[] } = {};
    this.lobbies.forEach((gameLobbies, gameTypeID) => {
      publicLobbies[gameTypeID] = gameLobbies.map((lobby) => ({
        MatchID: lobby.MatchID,
        GameTypeID: lobby.GameTypeID,
        CreatorID: lobby.CreatorID,
        Fee: lobby.Fee,
        CreatedAt: lobby.CreatedAt,
      }));
    });
    return publicLobbies;
  }

  public getActiveMatchDetails(
    compositeMatchId: string,
  ): ActiveMatchDetailsFromMM | undefined {
    return this.activeMatches.get(compositeMatchId);
  }

  public removeActiveMatch(compositeMatchId: string): boolean {
    return this.activeMatches.delete(compositeMatchId);
  }
}
