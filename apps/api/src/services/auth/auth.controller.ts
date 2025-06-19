import {
  Controller,
  Get,
  Logger,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { HttpCode, Post, Body, HttpStatus } from '@nestjs/common';
import { LocalAuthGuard } from './local.auth.guard';
import { AuthenticatedGuard } from './authenticated.guard';
import { userInfo } from 'os';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() userData: { username: string; email: string; password: string },
    @Request() req,
  ) {
    try {
      const user = await this.authService.registerUser(userData);
      return new Promise((resolve, reject) => {
        req.login(user, (err) => {
          if (err) return reject(err);
          resolve({ message: 'Registered and logged in', user });
        });
      });
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Request() req) {
    Logger.log(`USER LOGGED IN: ${req.user.Username} (${req.user.Email})`);
    return { message: 'Login successful', user: req.user };
  }

  @UseGuards(AuthenticatedGuard)
  @Get('protected')
  getHello(@Request() req) {
    Logger.log(`USER LOGGED IN: ${req.user.Username} (${req.user.Email})`);
    return req.user;
  }

  @Post('logout')
  logout(@Request() req, @Res({ passthrough: true }) res): any {
    Logger.log(req.user.Username + ' just logged out.');
    req.session.destroy();
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: false,
      path: '/',
    });
    return { msg: 'The user session has ended' };
  }

  @UseGuards(AuthenticatedGuard)
  @Get('session')
  getSession(@Request() req) {
    if (req.isAuthenticated()) {
      Logger.log(`Session of: ${req.user.Username} | ${req.user.Email}`);
      return { authenticated: true, user: req.user };
    } else {
      return { authenticated: false };
    }
  }
}
