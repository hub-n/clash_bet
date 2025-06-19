import {
  Controller,
  Post,
  Body,
  Get,
  Request,
  UseGuards,
  Logger,
  Param,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { MatchmakingService } from './matchmaking/matchmaking.service';

@Controller('matches')
export class MatchesController {
  private readonly logger = new Logger(MatchesController.name);
  constructor(
    private matchesService: MatchesService,
    private matchmakingService: MatchmakingService,
  ) {}

  @UseGuards(AuthenticatedGuard)
@Post('start')
async startMatch(
  @Request() req,
  @Body() body: { player2Id: number; stake: number; gameKey: string; lobbyUuid: string },
) {
  const player1Id = req.user?.UserID;
  if (!player1Id) {
    this.logger.error(
      'Controller Error: player1Id (req.user.UserID) is undefined in startMatch.',
    );
    throw new HttpException(
      'Authentication error: User ID not found.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  const { player2Id, stake, gameKey, lobbyUuid } = body;

  if (
    player2Id === undefined ||
    stake === undefined ||
    !gameKey ||
    typeof gameKey !== 'string' ||
    gameKey.trim() === '' ||
    !lobbyUuid ||
    typeof lobbyUuid !== 'string' ||
    lobbyUuid.trim() === ''
  ) {
    throw new BadRequestException(
      'Missing or invalid required fields: player2Id, stake, gameKey, or lobbyUuid.',
    );
  }

  this.logger.log(
    `Controller /matches/start: P1(${player1Id}) vs P2(${player2Id}), Stake(${stake}), GameKey(${gameKey}), LobbyUUID(${lobbyUuid})`,
  );
  return this.matchesService.startMatch(player1Id, player2Id, stake, gameKey, lobbyUuid);
}


  @UseGuards(AuthenticatedGuard)
  @Post('resolve')
  async resolveMatch(
    @Request() req,
    @Body() body: { winnerId: number; loserId: number; stake: number },
  ) {
    const { winnerId, loserId, stake } = body;
    if (
      winnerId === undefined ||
      loserId === undefined ||
      stake === undefined
    ) {
      throw new BadRequestException('Missing winnerId, loserId, or stake.');
    }
    return this.matchesService.resolveMatch(winnerId, loserId, stake);
  }

  @UseGuards(AuthenticatedGuard)
  @Get('history')
  async getMatchHistory(@Request() req) {
    const userId = req.user?.UserID;
    if (!userId) {
      this.logger.error('User ID not found in request for match history.');
      throw new HttpException(
        'Authentication error: User ID not found.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.matchesService.getMatchHistory(userId);
  }

  @UseGuards(AuthenticatedGuard)
  @Get(':compositeMatchId')
  async getGameSessionDetails(
    @Param('compositeMatchId') compositeMatchId: string,
  ) {
    this.logger.log(
      `[GameSessionController] Request for game session details: ${compositeMatchId}`,
    );
    const matchData =
      this.matchmakingService.getActiveMatchDetails(compositeMatchId);

    if (!matchData) {
      this.logger.warn(
        `[GameSessionController] No active match found for ID: ${compositeMatchId}`,
      );
      throw new NotFoundException(
        'Game session not found or no longer active.',
      );
    }

    const response = {
      id: matchData.compositeMatchId,
      type: matchData.gameKey,
      betAmount: matchData.betAmount,
      players: [
        {
          id: String(matchData.playerOne.id),
          name: matchData.playerOne.name,
        },
        {
          id: String(matchData.playerTwo.id),
          name: matchData.playerTwo.name,
        },
      ],
    };
    this.logger.log(
      `[GameSessionController] Returning session details: ${JSON.stringify(response)}`,
    );
    return response;
  }
}
