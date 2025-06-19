import { User } from 'src/users/users.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GameType } from '../games/gametypes/gametypes.entity';
import { GameMove } from '../games/gamemoves/gamemoves.entity';

@Entity('MATCHES')
export class Match {
  @PrimaryColumn({
    name: 'MATCHID',
    type: 'number',
  })
  MatchID: number;

  @ManyToOne(() => GameType, (gameType) => gameType.matches, {
    nullable: false,
  })
  @JoinColumn({ name: 'GAMETYPEID' })
  gameType: GameType;

  @Column({ name: 'GAMETYPEID' })
  GameTypeID: number;

  @ManyToOne(() => User, (user) => user.matchesAsPlayerOne, { nullable: false })
  @JoinColumn({ name: 'PLAYERONEID' })
  playerOne: User;

  @Column({ name: 'PLAYERONEID' })
  PlayerOneID: number;

  @ManyToOne(() => User, (user) => user.matchesAsPlayerTwo, { nullable: false })
  @JoinColumn({ name: 'PLAYERTWOID' })
  playerTwo: User;

  @Column({ name: 'PLAYERTWOID' })
  PlayerTwoID: number;

  @ManyToOne(() => User, (user) => user.wonMatches, {
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'WINNERID' })
  winner?: User;

  @Column({ name: 'WINNERID', nullable: true })
  WinnerID: number;

  @Column({
    name: 'ENTRYFEE',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  EntryFee: number;

  @Column({
    name: 'MATCHSTATE',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  MatchState: string;

  @CreateDateColumn({ name: 'STARTTIME' })
  StartTime: Date;

  @Column({ name: 'ENDTIME', type: 'timestamp', nullable: true })
  EndTime: Date;

  @Column({ name: 'SCORE', type: 'varchar', length: 500, nullable: true })
  Score: string;

  @Column({ name: 'LOBBYUUID', type: 'varchar2', length: 36, nullable: false, unique: true })
  lobbyUuid: string;

  @OneToMany(() => GameMove, (gameMove) => gameMove.match)
  gameMoves: GameMove[];
}
