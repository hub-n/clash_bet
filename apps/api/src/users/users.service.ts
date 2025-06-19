import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { Wallets } from './wallets/wallets.entity';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Wallets)
    private walletsRepository: Repository<Wallets>,
  ) {}

  async create(userData: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    const existingUserEmail = await this.usersRepository.findOne({
      where: [{ Email: userData.email }],
    });

    if (existingUserEmail) {
      throw new ConflictException(
        'There is already an account for this email!',
      );
    }

    const existingUserUsername = await this.usersRepository.findOne({
      where: [{ Username: userData.username }],
    });

    if (existingUserUsername) {
      throw new ConflictException('The username is already taken!');
    }

    const newUser = this.usersRepository.create({
      Username: userData.username,
      Email: userData.email,
      PasswordHash: userData.passwordHash,
      UserRole: 'user',
      stats: {},
      wallet: {},
    });

    return await this.usersRepository.save(newUser);
  }

  async findByID(id: number): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { UserID: id },
      relations: ['wallet', 'stats'],
    });
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { Email: email },
      relations: ['wallet', 'stats'],
    });
    return user;
  }

  async findByUsername(userName: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { Username: userName },
      relations: ['wallet', 'stats'],
    });
    return user;
  }

  async getUserWallet(userId: number): Promise<Wallets | null> {
    const user = await this.findByID(userId);
    return user?.wallet ?? null;
  }

  async remove(userId: number): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { UserID: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.usersRepository.remove(user);
  }

  async getBalance(userId: number): Promise<{ balance: number }> {
    const user = await this.findByID(userId);
    return { balance: user?.wallet.Balance ?? 0 };
  }

  async updateBalance(
    userId: number,
    newBalance: number,
  ): Promise<User | null> {
    const user = await this.findByID(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const wallet = await this.walletsRepository.findOne({
      where: {
        user: {
          UserID: userId,
        },
      },
      relations: ['user'],
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for this user');
    }

    wallet.Balance = newBalance;
    wallet.UpdatedAt = new Date();
    await this.walletsRepository.save(wallet);

    return user;
  }

  async updateUserInfo(
    userId: number,
    newUserFullName: string,
    newUserBio: string,
  ): Promise<User | null> {
    const user = await this.findByID(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    user.UserFullName = newUserFullName;
    user.UserBio = newUserBio;
    await this.usersRepository.save(user);

    return user;
  }
}
