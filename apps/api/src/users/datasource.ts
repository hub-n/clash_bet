import { DataSource } from 'typeorm';
import { User } from './users.entity';
import { PlayerStatistics } from './player-stats/player-stats.entity';
import { Wallets } from './wallets/wallets.entity';
import { Match } from '../services/matches/matches.entity';
import { GameType } from '../services/games/gametypes/gametypes.entity';
import { GameMove } from '../services/games/gamemoves/gamemoves.entity';
import { BalanceState } from 'src/services/balance-state/balance-state.entity';
import { Transaction } from 'src/services/transactions/transactions.entity';

export default new DataSource({
  type: 'oracle',
  connectString: 'ora4.ii.pw.edu.pl:1521/pdb1.ii.pw.edu.pl',
  username: '****', // Our faculty's database was used
  password: '****',
  database: 'ora4',
  entities: [
    User,
    PlayerStatistics,
    Wallets,
    Match,
    GameType,
    GameMove,
    BalanceState,
    Transaction,
  ],
  synchronize: false,
  logging: true,
});
