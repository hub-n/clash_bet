import {
  HttpStatus,
  Injectable,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service';
import { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async registerUser(userData: {
    username: string;
    email: string;
    password: string;
  }) {
    if (!userData.username || !userData.email || !userData.password) {
      throw new UnauthorizedException('Missing required fields');
    }
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    return this.usersService.create({
      username: userData.username,
      email: userData.email,
      passwordHash: hashedPassword,
    });
  }

  async loginUser(loginData: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(loginData.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(
      loginData.password,
      user.PasswordHash,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }
}
