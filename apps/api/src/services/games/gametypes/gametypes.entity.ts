import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Match } from 'src/services/matches/matches.entity';

@Entity('GAMETYPES')
export class GameType {
  @PrimaryGeneratedColumn({ name: 'GAMETYPEID' })
  gameTypeID: number;

  @Column({ name: 'GAMENAME', type: 'varchar', length: 40, nullable: false })
  gameName: string;

  @Column({
    name: 'GAMEDESCRIPTION',
    type: 'varchar',
    length: 400,
    nullable: true,
  })
  gameDescription: string | null;

  @Column({ name: 'CONFIG', type: 'varchar', length: 500, nullable: true })
  config: string | null;

  @OneToMany(() => Match, (match) => match.gameType)
  matches: Match[];
}
