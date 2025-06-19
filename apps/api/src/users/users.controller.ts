import {
  Controller,
  Get,
  UseGuards,
  Request,
  Logger,
  Patch,
  Body,
} from '@nestjs/common';
import { AuthenticatedGuard } from 'src/services/auth/authenticated.guard';
import { UsersService } from './users.service';
import { User } from './users.entity';
import { get } from 'http';

@Controller('user')
export class UsersController {
  constructor(private userService: UsersService) {}

  @UseGuards(AuthenticatedGuard)
  @Get('balance')
  async getBalance(@Request() req) {
    Logger.log(req.user.wallet);
    Logger.log('QUERYING FOR ID OF ' + req.user.UserID);
    return this.userService.getBalance(req.user.UserID);
  }

  @UseGuards(AuthenticatedGuard)
  @Get('me')
  async getProfile(@Request() req) {
    console.log('MeRequest: User ID: ' + req.user?.UserID);
    return this.userService.findByID(req.user.UserID);
  }

  @UseGuards(AuthenticatedGuard)
  @Get('wallet')
  async getWallet(@Request() req) {
    console.log('WalletRequest: User ID: ' + req.user?.UserID);
    return this.userService.getUserWallet(req.user?.UserID);
  }

  @UseGuards(AuthenticatedGuard)
  @Patch('update-balance')
  async updateBalance(@Request() req, @Body() body: { newBalance: number }) {
    console.log('UpdateBalance: User ID: ', req.user?.UserID);
    console.log('Body:', body);
    const { newBalance } = body;
    return this.userService.updateBalance(req.user.UserID, newBalance);
  }

  @UseGuards(AuthenticatedGuard)
  @Patch('update-user-info')
  async updateUserInfo(
    @Request() req,
    @Body() body: { newUserFullName: string; newUserBio: string },
  ) {
    console.log('UpdateUserInfo: User ID: ', req.user?.UserID);
    const { newUserFullName, newUserBio } = body;
    return this.userService.updateUserInfo(
      req.user?.UserID,
      newUserFullName,
      newUserBio,
    );
  }
}
