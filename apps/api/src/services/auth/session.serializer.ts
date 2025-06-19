import { Injectable, Logger } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { User } from 'src/users/users.entity';
import { UsersService } from 'src/users/users.service';
@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly usersService: UsersService) {
    super();
  }
  serializeUser(user: User, done: (err: Error | null, user: any) => void): any {
    Logger.log('SERIALIZING FOR: ' + user.UserID);
    done(null, user.UserID);
  }
  async deserializeUser(
    id: number,
    done: (err: Error | null, user: User | null) => void,
  ): Promise<void> {
    Logger.log('DESERIALIZING FOR: ' + id.toString());
    try {
      const user = await this.usersService.findByID(id);
      Logger.log(user?.Username + '#' + user?.UserID + ' DESERIALIZED');
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
}
