import { Test, TestingModule } from '@nestjs/testing';
import { BalanceStateService } from './balance-state.service';

describe('BalanceStateService', () => {
  let service: BalanceStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BalanceStateService],
    }).compile();

    service = module.get<BalanceStateService>(BalanceStateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
