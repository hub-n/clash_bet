import { Match } from 'src/services/matches/matches.entity';
import { User } from 'src/users/users.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('GAMEMOVES')
export class GameMove {
  @PrimaryGeneratedColumn({ name: 'LOGID' })
  LogID: number;

  @Column({ name: 'MATCHID', type: 'integer', nullable: false })
  MatchID: number;

  @ManyToOne(() => Match, (match) => match.gameMoves)
  @JoinColumn({ name: 'MATCHID' })
  match: Match;

  @Column({ name: 'PLAYERID', type: 'integer', nullable: false })
  PlayerID: number;

  @ManyToOne(() => User, (user) => user.gameMoves)
  @JoinColumn({ name: 'PLAYERID' })
  player: User;

  @Column({
    name: 'MOVEDETAILS',
    type: 'varchar',
    length: 4000,
    nullable: true,
  })
  moveDetails: string | object;

  @CreateDateColumn({ name: 'TIMESTAMP', type: 'timestamp' })
  Timestamp: Date;
}
