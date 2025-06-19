import { Controller, Get } from '@nestjs/common';
import {
  Post,
  Body,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from 'src/services/auth/authenticated.guard';
import { MatchmakingService } from './matchmaking.service';

const GAME_ID_TO_TYPE_MAP: { [key: string]: number } = {
  'rock-paper-scissors': 1,
  battleships: 2,
  minesweeper: 3,
};

const VALID_GAME_IDS = Object.keys(GAME_ID_TO_TYPE_MAP);

@Controller('matchmaking')
export class MatchmakingController {
  private readonly logger = new Logger(MatchmakingController.name);

  constructor(private readonly matchmakingService: MatchmakingService) {}

  @UseGuards(AuthenticatedGuard)
  @Post('find-or-create')
  async findOrCreateMatch(
    @Request() req,
    @Body()
    body: {
      gameId: string;
      targetFee: number;
      feeRange: number;
    },
  ) {
    const playerID = req.user?.UserID;

    if (!playerID) {
      this.logger.error('User ID not found in request for matchmaking.');
      throw new HttpException(
        'User authentication error.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const { gameId, targetFee, feeRange } = body;

    if (!gameId || targetFee === undefined || feeRange === undefined) {
      throw new HttpException(
        'Missing required fields: gameId, targetFee, or feeRange.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const gameTypeID = GAME_ID_TO_TYPE_MAP[gameId];

    if (gameTypeID === undefined) {
      this.logger.error(`Invalid gameId received: ${gameId}`);
      throw new HttpException(
        `Invalid game ID: ${gameId}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      typeof targetFee !== 'number' ||
      targetFee <= 0 ||
      typeof feeRange !== 'number' ||
      feeRange < 0
    ) {
      throw new HttpException(
        'Invalid fee or range values.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (feeRange >= targetFee && targetFee > 0) {
      throw new HttpException(
        'Fluctuation (feeRange) cannot be greater than or equal to the bet amount (targetFee).',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `Player ${playerID} requesting match for gameType ${gameTypeID} (ID: ${gameId}) with fee ${targetFee} +/- ${feeRange}`,
    );

    try {
      const result = await this.matchmakingService.findOrCreate(
        playerID,
        gameTypeID,
        targetFee,
        feeRange,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error during matchmaking for player ${playerID}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Matchmaking service error.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('lobbies')
  getLobbies() {
    return this.matchmakingService.getLobbies();
  }
}
