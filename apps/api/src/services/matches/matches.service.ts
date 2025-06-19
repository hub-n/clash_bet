import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common'; // Added Inject, forwardRef
import { UsersService } from 'src/users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Between } from 'typeorm';
import { Match } from './matches.entity';
import { PlayerStatsService } from 'src/users/player-stats/player-stats.service';

const GAME_KEY_TO_GAMETYPEID: Record<string, number> = {
  'rock-paper-scissors': 1,
  battleships: 2,
  minesweeper: 3,
};

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private usersService: UsersService,
    @InjectRepository(Match)
    private matchesRepository: Repository<Match>,
    @Inject(forwardRef(() => PlayerStatsService))
    private playerStatsService: PlayerStatsService,
  ) {}

  private getGameTypeIdFromKey(gameKey: string): number {
    const gameTypeId = GAME_KEY_TO_GAMETYPEID[gameKey];
    if (gameTypeId === undefined) {
      this.logger.error(
        `No GameTypeID found for gameKey: '${gameKey}'. This game type is not configured.`,
      );
      throw new Error(
        `Unsupported gameKey: ${gameKey}. No corresponding GameTypeID found.`,
      );
    }
    return gameTypeId;
  }

  async startMatch(
    player1Id: number,
    player2Id: number,
    stake: number,
    gameKeyForGameTypeID: string,
    lobbyUuid: string,
  ): Promise<{ message: string; matchId: number; alreadyExisted: boolean }> {
    if (
      !gameKeyForGameTypeID ||
      typeof gameKeyForGameTypeID !== 'string' ||
      gameKeyForGameTypeID.trim() === ''
    ) {
      this.logger.error(
        `gameKeyForGameTypeID is missing or invalid in startMatch. Provided: '${gameKeyForGameTypeID}'`,
      );
      throw new Error('A valid gameKey must be provided to start a match.');
    }

    const gameTypeId = this.getGameTypeIdFromKey(gameKeyForGameTypeID);
    const matchStateName = `IN_PROGRESS_${gameKeyForGameTypeID.toUpperCase().replace(/-/g, '_')}`;

    const existingMatch = await this.matchesRepository.findOne({
      where: { lobbyUuid },
    });

    if (existingMatch) {
      this.logger.warn(
        `Match (P1:${player1Id}, P2:${player2Id}, Game:${gameTypeId}, State:${matchStateName}) already exists with DB ID ${existingMatch.MatchID}. Not deducting stake again.`,
      );
      return {
        message: 'Match already in progress.',
        matchId: existingMatch.MatchID,
        alreadyExisted: true,
      };
    }

    const wallet1 = await this.usersService.getUserWallet(player1Id);
    const wallet2 = await this.usersService.getUserWallet(player2Id);

    if (!wallet1 || !wallet2) {
      this.logger.error(
        `Wallet not found for P1(${player1Id}) or P2(${player2Id})`,
      );
      throw new NotFoundException('One or both player wallets not found');
    }

    const numericStake = Number(stake);
    const numericBalance1 = Number(wallet1.Balance);
    const numericBalance2 = Number(wallet2.Balance);

    if (numericBalance1 < numericStake || numericBalance2 < numericStake) {
      this.logger.error(
        `Insufficient balance for P1(${player1Id}, Bal:${numericBalance1}) or P2(${player2Id}, Bal:${numericBalance2}) for stake ${numericStake}`,
      );
      throw new Error('One or both players have insufficient balance');
    }

    await this.usersService.updateBalance(
      player1Id,
      numericBalance1 - numericStake,
    );
    await this.usersService.updateBalance(
      player2Id,
      numericBalance2 - numericStake,
    );
    this.logger.log(
      `Stake ${numericStake} deducted for P1(${player1Id}) and P2(${player2Id}) for new match.`,
    );

    const match = this.matchesRepository.create({
      PlayerOneID: player1Id,
      PlayerTwoID: player2Id,
      GameTypeID: gameTypeId,
      EntryFee: numericStake,
      MatchState: matchStateName,
      StartTime: new Date(),
      lobbyUuid,
    });

    try {
      const savedMatch = await this.matchesRepository.save(match);
      this.logger.log(
        `New Match ${savedMatch.MatchID} (GameType: ${gameTypeId}) started between P1(${player1Id}) and P2(${player2Id})`,
      );

      return {
        message: 'Match started, stake deducted.',
        matchId: savedMatch.MatchID,
        alreadyExisted: false,
      };
    } catch (error: any) {
      if (
        error.code === 'ORA-00001' &&
        error.message.includes('UQ_MATCHES_LOBBYUUID')
      ) {
        this.logger.warn(
          `Duplicate lobbyUuid: ${lobbyUuid}. Match likely already created in concurrent thread.`,
        );
        const existingMatchAfterConflict = await this.matchesRepository.findOne(
          {
            where: { lobbyUuid },
          },
        );
        if (existingMatchAfterConflict) {
          return {
            message: 'Match already in progress (post-conflict).',
            matchId: existingMatchAfterConflict.MatchID,
            alreadyExisted: true,
          };
        } else {
          throw new Error(
            `Duplicate match creation detected but no match found in DB for UUID ${lobbyUuid}`,
          );
        }
      }
      throw error;
    }
  }

  async resolveMatch(
    winnerId: number,
    loserId: number,
    stake: number,
    dbMatchId?: number,
    finalScoreString?: string,
    lobbyUuid?: string,
  ): Promise<{ message: string; winnerNewBalance: number }> {
    const numericStake = Number(stake);
    const reward = 0.75 * numericStake * 2;

    const winnerWallet = await this.usersService.getUserWallet(winnerId);
    if (!winnerWallet) {
      this.logger.error(`Winner wallet not found for ID ${winnerId}`);
      throw new NotFoundException(`Winner wallet not found for ID ${winnerId}`);
    }

    const currentWinnerBalance = Number(winnerWallet.Balance);
    const newWinnerBalance = currentWinnerBalance + reward;

    await this.usersService.updateBalance(winnerId, newWinnerBalance);
    this.logger.log(
      `User ${winnerId} wallet updated. Old: ${currentWinnerBalance}, New: ${newWinnerBalance}, Reward: ${reward}`,
    );

    let matchToUpdate: Match | null = null;

    if (dbMatchId) {
      matchToUpdate = await this.matchesRepository.findOne({
        where: { MatchID: dbMatchId },
      });
    }

    if (!matchToUpdate && lobbyUuid) {
      this.logger.warn(`Trying fallback resolve by lobbyUuid: ${lobbyUuid}`);
      matchToUpdate = await this.matchesRepository.findOne({
        where: { lobbyUuid },
      });
    }

    if (!matchToUpdate) {
      this.logger.warn(
        `Resolving match without specific dbMatchId or lobbyUuid. Finding latest IN_PROGRESS match (any type) between ${winnerId} and ${loserId}. This is broad.`,
      );
      matchToUpdate = await this.matchesRepository.findOne({
        where: [
          {
            PlayerOneID: winnerId,
            PlayerTwoID: loserId,
            MatchState: Like('IN_PROGRESS%'),
          },
          {
            PlayerOneID: loserId,
            PlayerTwoID: winnerId,
            MatchState: Like('IN_PROGRESS%'),
          },
        ],
        order: { StartTime: 'DESC' },
      });
    }

    if (matchToUpdate) {
      if (
        !(
          (matchToUpdate.PlayerOneID === winnerId &&
            matchToUpdate.PlayerTwoID === loserId) ||
          (matchToUpdate.PlayerOneID === loserId &&
            matchToUpdate.PlayerTwoID === winnerId)
        )
      ) {
        this.logger.error(
          `Player ID mismatch: Match ${matchToUpdate.MatchID} players (${matchToUpdate.PlayerOneID}, ${matchToUpdate.PlayerTwoID}) do not align with provided winner/loser (${winnerId}, ${loserId}). Aborting DB update for this match.`,
        );
        throw new Error(
          'Resolved player IDs do not match players in the identified game record.',
        );
      }

      matchToUpdate.WinnerID = winnerId;
      matchToUpdate.EndTime = new Date();
      matchToUpdate.MatchState = 'COMPLETED';
      if (finalScoreString) {
        matchToUpdate.Score = finalScoreString;
      }
      await this.matchesRepository.save(matchToUpdate);
      this.logger.log(
        `Match ${matchToUpdate.MatchID} resolved in DB. Winner: ${winnerId}, Score: ${finalScoreString || 'N/A'}`,
      );

      try {
        await this.playerStatsService.updateStatsForMatchOutcome(
          winnerId,
          loserId,
        );
      } catch (statsError) {
        this.logger.error(
          `Failed to update player statistics for match ${matchToUpdate.MatchID} (Winner: ${winnerId}, Loser: ${loserId}): ${statsError.message}`,
          statsError.stack,
        );
      }
    } else {
      const errorMsg = `Could not find a suitable match to resolve for winner ${winnerId}, loser ${loserId}. (dbMatchId provided: ${dbMatchId || 'N/A'}, lobbyUuid: ${lobbyUuid || 'N/A'})`;
      this.logger.error(errorMsg);
      throw new NotFoundException(errorMsg);
    }

    return {
      message: `Match resolved. Winner ${winnerId} received ${reward}`,
      winnerNewBalance: newWinnerBalance,
    };
  }

  async resolveMatchAsDraw(
    dbMatchId: number,
    stake: number,
    finalScoreString?: string,
    lobbyUuid?: string,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Match ${dbMatchId} (Lobby: ${lobbyUuid}) is a draw. Refunding stakes.`,
    );
    let matchToUpdate: Match | null = null;

    if (dbMatchId) {
      matchToUpdate = await this.matchesRepository.findOne({
        where: { MatchID: dbMatchId },
      });
    }
    if (!matchToUpdate && lobbyUuid) {
      matchToUpdate = await this.matchesRepository.findOne({
        where: { lobbyUuid },
      });
    }

    if (!matchToUpdate) {
      const errorMsg = `Could not find match ${dbMatchId} (Lobby: ${lobbyUuid}) to resolve as draw.`;
      this.logger.error(errorMsg);
      throw new NotFoundException(errorMsg);
    }

    const numericStake = Number(stake);
    const p1Wallet = await this.usersService.getUserWallet(
      matchToUpdate.PlayerOneID,
    );
    const p2Wallet = await this.usersService.getUserWallet(
      matchToUpdate.PlayerTwoID,
    );

    if (p1Wallet) {
      await this.usersService.updateBalance(
        matchToUpdate.PlayerOneID,
        Number(p1Wallet.Balance) + numericStake,
      );
      this.logger.log(
        `Refunded ${numericStake} to Player ${matchToUpdate.PlayerOneID} for draw.`,
      );
    }
    if (p2Wallet) {
      await this.usersService.updateBalance(
        matchToUpdate.PlayerTwoID,
        Number(p2Wallet.Balance) + numericStake,
      );
      this.logger.log(
        `Refunded ${numericStake} to Player ${matchToUpdate.PlayerTwoID} for draw.`,
      );
    }

    matchToUpdate.MatchState = 'DRAW';
    matchToUpdate.EndTime = new Date();
    if (finalScoreString) {
      matchToUpdate.Score = finalScoreString;
    }
    await this.matchesRepository.save(matchToUpdate);

    try {
      await this.playerStatsService.updateStatsForDraw(
        matchToUpdate.PlayerOneID,
        matchToUpdate.PlayerTwoID,
      );
    } catch (statsError) {
      this.logger.error(
        `Failed to update player statistics for draw in match ${matchToUpdate.MatchID}: ${statsError.message}`,
        statsError.stack,
      );
    }

    return {
      message: `Match ${matchToUpdate.MatchID} ended in a draw. Stakes refunded.`,
    };
  }

  async getMatchHistory(userId: number): Promise<Match[]> {
    return this.matchesRepository.find({
      where: [{ PlayerOneID: userId }, { PlayerTwoID: userId }],
      relations: ['playerOne', 'playerTwo', 'winner', 'gameType'],
      order: { StartTime: 'DESC' },
    });
  }

  async getMatchById(matchId: number): Promise<Match | null> {
    this.logger.log(`Fetching match by DB ID: ${matchId}`);
    const match = await this.matchesRepository.findOne({
      where: { MatchID: matchId },
    });
    if (!match) {
      this.logger.warn(`Match with DB ID ${matchId} not found.`);
    }
    return match;
  }

  async getAllCompletedMatches(
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Match[]> {
    this.logger.log(
      `Fetching completed matches for UserID ${userId} between ${startDate.toISOString()} and ${endDate.toISOString()}`,
    );
    return this.matchesRepository.find({
      where: [
        {
          PlayerOneID: userId,
          MatchState: In(['COMPLETED', 'DRAW']),
          EndTime: Between(startDate, endDate),
        },
        {
          PlayerTwoID: userId,
          MatchState: In(['COMPLETED', 'DRAW']),
          EndTime: Between(startDate, endDate),
        },
      ],
      order: { EndTime: 'ASC' },
    });
  }
}
