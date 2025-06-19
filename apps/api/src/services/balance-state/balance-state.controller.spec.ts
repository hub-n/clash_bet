import { Test, TestingModule } from '@nestjs/testing';
import { BalanceStateController } from './balance-state.controller';

describe('BalanceStateController', () => {
  let controller: BalanceStateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceStateController],
    }).compile();

    controller = module.get<BalanceStateController>(BalanceStateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
