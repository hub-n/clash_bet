import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerStatistics } from './player-stats.entity';
import { LeaderboardEntry } from '../interfaces/leaderboard-entry.interface';
import { MatchesService } from 'src/services/matches/matches.service';
import { UsersService } from 'src/users/users.service';
import { Match } from 'src/services/matches/matches.entity';

export interface DailyWinRate {
  date: string;
  winRatio: number;
}

@Injectable()
export class PlayerStatsService {
  private readonly logger = new Logger(PlayerStatsService.name);

  constructor(
    @InjectRepository(PlayerStatistics)
    private playerStatsRepository: Repository<PlayerStatistics>,
    private readonly matchesService: MatchesService,
    private readonly usersService: UsersService,
  ) {}

  async getLeaderboardCount(): Promise<number> {
    return this.playerStatsRepository.count();
  }

  async getLeaderboardData(
    offset: number,
    limit: number,
  ): Promise<LeaderboardEntry[]> {
    const stats = await this.playerStatsRepository
      .createQueryBuilder('stat')
      .innerJoinAndSelect('stat.user', 'user')
      .select([
        'user.Username AS "username"',
        'stat.Wins AS "wins"',
        'stat.WinRate AS "winRatio"',
        '(stat.Wins + stat.Losses + stat.Draws) AS "matchesCount"',
      ])
      .orderBy('stat.Wins', 'DESC')
      .addOrderBy('"matchesCount"', 'DESC')
      .addOrderBy('user.Username', 'ASC')
      .offset(offset)
      .limit(limit)
      .getRawMany<LeaderboardEntry>();

    return stats.map((record) => ({
      username: record.username,
      wins: parseInt(record.wins as any, 10),
      winRatio: parseFloat(record.winRatio as any),
      matchesCount: parseInt(record.matchesCount as any, 10),
    }));
  }
  private async calculateCumulativeDailyWinRatesForUser(
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyWinRate[]> {
    const allMatchesForUserInRange =
      await this.matchesService.getAllCompletedMatches(
        userId,
        startDate,
        endDate,
      );

    if (!allMatchesForUserInRange || allMatchesForUserInRange.length === 0) {
      const emptyRates: DailyWinRate[] = [];
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        emptyRates.push({ date: d.toISOString().split('T')[0], winRatio: 0 });
      }
      return emptyRates;
    }

    const sortedMatches = allMatchesForUserInRange.sort((a, b) => {
      if (!a.EndTime || !b.EndTime) return 0;
      return a.EndTime.getTime() - b.EndTime.getTime();
    });

    const dailyWinRatesData: DailyWinRate[] = [];
    let cumulativeWins = 0;
    let cumulativeLosses = 0;
    let cumulativeDraws = 0;

    const processedDates: Record<string, boolean> = {};
    let lastProcessedDateStr = '';

    for (const match of sortedMatches) {
      if (!match.EndTime) continue;
      const matchDateStr = match.EndTime.toISOString().split('T')[0];

      if (lastProcessedDateStr && matchDateStr !== lastProcessedDateStr) {
        if (!processedDates[lastProcessedDateStr]) {
          const totalGames =
            cumulativeWins + cumulativeLosses + cumulativeDraws;
          const winRatio =
            totalGames > 0
              ? parseFloat((cumulativeWins / totalGames).toFixed(3))
              : 0;
          dailyWinRatesData.push({ date: lastProcessedDateStr, winRatio });
          processedDates[lastProcessedDateStr] = true;
        }
      }

      if (match.MatchState === 'DRAW') {
        cumulativeDraws++;
      } else if (match.WinnerID === userId) {
        cumulativeWins++;
      } else {
        if (match.PlayerOneID === userId || match.PlayerTwoID === userId) {
          cumulativeLosses++;
        }
      }
      lastProcessedDateStr = matchDateStr;
    }

    if (lastProcessedDateStr && !processedDates[lastProcessedDateStr]) {
      const totalGames = cumulativeWins + cumulativeLosses + cumulativeDraws;
      const winRatio =
        totalGames > 0
          ? parseFloat((cumulativeWins / totalGames).toFixed(3))
          : 0;
      dailyWinRatesData.push({ date: lastProcessedDateStr, winRatio });
      processedDates[lastProcessedDateStr] = true;
    }

    const finalDailyRates: DailyWinRate[] = [];
    let lastKnownWinRate = 0;

    let dataIndex = 0;
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const currentDateStr = d.toISOString().split('T')[0];
      if (
        dataIndex < dailyWinRatesData.length &&
        dailyWinRatesData[dataIndex].date === currentDateStr
      ) {
        lastKnownWinRate = dailyWinRatesData[dataIndex].winRatio;
        finalDailyRates.push({
          date: currentDateStr,
          winRatio: lastKnownWinRate,
        });
        dataIndex++;
      } else {
        finalDailyRates.push({
          date: currentDateStr,
          winRatio: lastKnownWinRate,
        });
      }
    }

    return finalDailyRates;
  }

  async getWinRateHistoryForUsers(
    rawUserIds: string,
    rangeOption: string = 'last30days',
  ): Promise<Record<string, DailyWinRate[]>> {
    this.logger.log(
      `Fetching cumulative daily win rate history for userIDs: ${rawUserIds}, range: ${rangeOption}`,
    );
    const identifiers = rawUserIds.split(',');
    const loggedInUserIdentifierStr = identifiers[0];
    const topPlayerIdentifierStr =
      identifiers.length > 1 ? identifiers[1] : null;

    const numDays =
      rangeOption === 'last7days' ? 7 : rangeOption === 'last90days' ? 90 : 30;
    const today = new Date();
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (numDays - 1));
    startDate.setHours(0, 0, 0, 0);

    this.logger.log(
      `Calculating history from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const results: Record<string, DailyWinRate[]> = {};

    const loggedInUserIdNum = parseInt(loggedInUserIdentifierStr, 10);
    if (isNaN(loggedInUserIdNum)) {
      this.logger.warn(
        `Invalid UserID for loggedInUser: ${loggedInUserIdentifierStr}`,
      );
    } else {
      results[loggedInUserIdentifierStr] =
        await this.calculateCumulativeDailyWinRatesForUser(
          loggedInUserIdNum,
          startDate,
          endDate,
        );
    }

    if (
      topPlayerIdentifierStr &&
      topPlayerIdentifierStr !== loggedInUserIdentifierStr
    ) {
      let topPlayerUserIdToQuery: number | null = null;
      const parsedTopId = parseInt(topPlayerIdentifierStr, 10);

      if (!isNaN(parsedTopId)) {
        topPlayerUserIdToQuery = parsedTopId;
      } else {
        const topUser = await this.usersService.findByUsername(
          topPlayerIdentifierStr,
        );
        if (topUser) {
          topPlayerUserIdToQuery = topUser.UserID;
        } else {
          this.logger.warn(
            `Top player username not found: ${topPlayerIdentifierStr}`,
          );
        }
      }

      if (topPlayerUserIdToQuery) {
        results[topPlayerIdentifierStr] =
          await this.calculateCumulativeDailyWinRatesForUser(
            topPlayerUserIdToQuery,
            startDate,
            endDate,
          );
      }
    }
    return results;
  }
  
  private calculateWinRate(stats: PlayerStatistics): number {
    const totalGamesPlayed = stats.Wins + stats.Losses + stats.Draws;
    if (totalGamesPlayed > 0) {
      return parseFloat(((stats.Wins / totalGamesPlayed) * 100).toFixed(2));
    }
    return 0.0;
  }

  async updateStatsForMatchOutcome(
    winnerId: number,
    loserId: number,
  ): Promise<void> {
    this.logger.log(
      `Updating stats for Winner: ${winnerId}, Loser: ${loserId}`,
    );
    const winnerStats = await this.playerStatsRepository.findOne({
      where: { UserID: winnerId },
    });
    const loserStats = await this.playerStatsRepository.findOne({
      where: { UserID: loserId },
    });

    if (!winnerStats) {
      this.logger.error(
        `PlayerStatistics not found for winner ID: ${winnerId}. Stats will not be updated.`,
      );
    } else {
      winnerStats.Wins += 1;
      winnerStats.CurrentStreak =
        winnerStats.CurrentStreak >= 0 ? winnerStats.CurrentStreak + 1 : 1;
      winnerStats.WinRate = this.calculateWinRate(winnerStats);
      winnerStats.LastUpdated = new Date();
      await this.playerStatsRepository.save(winnerStats);
      this.logger.log(
        `Winner ${winnerId} stats updated: W: ${winnerStats.Wins}, CS: ${winnerStats.CurrentStreak}, WR: ${winnerStats.WinRate}`,
      );
    }

    if (!loserStats) {
      this.logger.error(
        `PlayerStatistics not found for loser ID: ${loserId}. Stats will not be updated.`,
      );
    } else {
      loserStats.Losses += 1;
      loserStats.CurrentStreak = 0;
      loserStats.WinRate = this.calculateWinRate(loserStats);
      loserStats.LastUpdated = new Date();
      await this.playerStatsRepository.save(loserStats);
      this.logger.log(
        `Loser ${loserId} stats updated: L: ${loserStats.Losses}, CS: ${loserStats.CurrentStreak}, WR: ${loserStats.WinRate}`,
      );
    }
  }

  async updateStatsForDraw(
    player1Id: number,
    player2Id: number,
  ): Promise<void> {
    this.logger.log(
      `Updating stats for Draw between Player1: ${player1Id}, Player2: ${player2Id}`,
    );
    const player1Stats = await this.playerStatsRepository.findOne({
      where: { UserID: player1Id },
    });
    const player2Stats = await this.playerStatsRepository.findOne({
      where: { UserID: player2Id },
    });

    if (!player1Stats) {
      this.logger.error(
        `PlayerStatistics not found for player ID: ${player1Id} in draw. Stats will not be updated.`,
      );
    } else {
      player1Stats.Draws += 1;
      player1Stats.CurrentStreak = 0;
      player1Stats.WinRate = this.calculateWinRate(player1Stats);
      player1Stats.LastUpdated = new Date();
      await this.playerStatsRepository.save(player1Stats);
      this.logger.log(
        `Player ${player1Id} (draw) stats updated: D: ${player1Stats.Draws}, CS: ${player1Stats.CurrentStreak}, WR: ${player1Stats.WinRate}`,
      );
    }

    if (!player2Stats) {
      this.logger.error(
        `PlayerStatistics not found for player ID: ${player2Id} in draw. Stats will not be updated.`,
      );
    } else {
      player2Stats.Draws += 1;
      player2Stats.CurrentStreak = 0;
      player2Stats.WinRate = this.calculateWinRate(player2Stats);
      player2Stats.LastUpdated = new Date();
      await this.playerStatsRepository.save(player2Stats);
      this.logger.log(
        `Player ${player2Id} (draw) stats updated: D: ${player2Stats.Draws}, CS: ${player2Stats.CurrentStreak}, WR: ${player2Stats.WinRate}`,
      );
    }
  }
}
