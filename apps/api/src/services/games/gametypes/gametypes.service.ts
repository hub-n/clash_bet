import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameType } from './gametypes.entity';

@Injectable()
export class GameTypesService {
  private gameTypesCache: GameType[] | null = null;

  constructor(
    @InjectRepository(GameType)
    private gameTypesRepository: Repository<GameType>,
  ) {}

  async onModuleInit() {
    await this.getAllGameTypes();
  }

  async getAllGameTypes(): Promise<GameType[]> {
    if (!this.gameTypesCache) {
      this.gameTypesCache = await this.gameTypesRepository.find();
    }
    return this.gameTypesCache;
  }

  async findByGameName(gameName: string): Promise<GameType | null> {
    const games = await this.getAllGameTypes();
    const gameType = games.find((gt) => gt.gameName === gameName);
    return gameType ?? null;
  }

  async findById(id: number): Promise<GameType | null> {
    const games = await this.getAllGameTypes();
    const gameType = games.find((gt) => gt.gameTypeID === id);
    return gameType ?? null;
  }
}
