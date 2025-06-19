import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { PlayerStatsService, DailyWinRate } from './player-stats.service';
import { LeaderboardQueryDto } from '../interfaces/leaderboard-query.dto';
import { LeaderboardEntry } from '../interfaces/leaderboard-entry.interface';
import { AuthenticatedGuard } from 'src/services/auth/authenticated.guard';

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 5;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const MIN_OFFSET = 0;

@Controller('player-stats')
export class PlayerStatsController {
  private readonly logger = new Logger(PlayerStatsController.name);

  constructor(private readonly playerStatsService: PlayerStatsService) {}

  @Get('leaderboard-total')
  async getTotalRecords(): Promise<{ totalRecords: number }> {
    this.logger.log('Request received for /leaderboard-total');
    const count = await this.playerStatsService.getLeaderboardCount();
    return { totalRecords: count };
  }

  @Get('leaderboard-range')
  async getRecordsRange(
    @Query() query: LeaderboardQueryDto,
  ): Promise<{ records: LeaderboardEntry[] }> {
    this.logger.log(
      `Request received for /leaderboard-range with query: ${JSON.stringify(query)}`,
    );
    let offset = DEFAULT_OFFSET;
    let effectiveLimit = DEFAULT_LIMIT;

    if (query.offset !== undefined) {
      const parsedOffset = parseInt(query.offset, 10);
      if (isNaN(parsedOffset) || parsedOffset < MIN_OFFSET) {
        throw new BadRequestException(
          `Invalid offset value. Must be a non-negative number.`,
        );
      }
      offset = parsedOffset;
    }

    if (query.limit !== undefined) {
      const parsedLimit = parseInt(query.limit, 10);
      if (
        isNaN(parsedLimit) ||
        parsedLimit < MIN_LIMIT ||
        parsedLimit > MAX_LIMIT
      ) {
        throw new BadRequestException(
          `Invalid limit value. Must be a number between ${MIN_LIMIT} and ${MAX_LIMIT}.`,
        );
      }
      effectiveLimit = parsedLimit;
    }

    const records = await this.playerStatsService.getLeaderboardData(
      offset,
      effectiveLimit,
    );
    return { records };
  }

  @UseGuards(AuthenticatedGuard)
  @Get('win-ratio-history')
  async getWinRateHistory(
    @Request() req,
    @Query('userIds') userIds: string,
    @Query('range') range?: string,
  ): Promise<Record<string, DailyWinRate[]>> {
    this.logger.log(
      `Request received for /win-ratio-history. UserIDs: ${userIds}, Range: ${range}, Authenticated User: ${req.user?.UserID}`,
    );
    if (!userIds) {
      throw new BadRequestException('userIds query parameter is required.');
    }
    return this.playerStatsService.getWinRateHistoryForUsers(
      userIds,
      range || 'last30days',
    );
  }
}
