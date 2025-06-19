import { Test, TestingModule } from '@nestjs/testing';
import { GametypesService } from './gametypes.service';

describe('GametypesService', () => {
  let service: GametypesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GametypesService],
    }).compile();

    service = module.get<GametypesService>(GametypesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
