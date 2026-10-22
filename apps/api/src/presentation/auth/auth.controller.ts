import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ServerResponse } from 'node:http';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { AuthService } from '../../business/auth/auth.service';
import { AuthOriginGuard, LoginRateGuard, SessionGuard } from './auth.guards';
import { AuthRequest, clearSessionCookie, sessionToken, writeSessionCookie } from './auth.http';

@ApiTags('auth')
@Controller('auth')
@UseGuards(AuthOriginGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(LoginRateGuard)
  @ApiOperation({ summary: 'Đăng nhập và tạo cookie phiên (8 giờ mặc định)' })
  @ApiResponse({ status: 200, description: 'Tài khoản hiện tại và thời hạn phiên; token chỉ có trong cookie HttpOnly' })
  @ApiResponse({ status: 401, description: 'Thông tin đăng nhập không hợp lệ' })
  @ApiResponse({ status: 429, description: 'Vượt giới hạn thử đăng nhập' })
  async login(@Body() dto: LoginDto, @Req() request: AuthRequest, @Res({ passthrough: true }) response: ServerResponse) {
    const result = await this.auth.login(dto);
    await this.auth.logout(sessionToken(request));
    writeSessionCookie(response, result.token, this.auth.lifetimeSeconds, this.auth.secureCookie);
    return { user: result.user, expiresAt: result.expiresAt };
  }

  @Post('mobile/login')
  @HttpCode(200)
  @UseGuards(LoginRateGuard)
  @ApiOperation({ summary: 'Đăng nhập ứng dụng mobile và nhận Bearer token phiên' })
  @ApiResponse({ status: 200, description: 'Trả accessToken dùng trong Authorization: Bearer' })
  async mobileLogin(@Body() dto: LoginDto, @Res({ passthrough: true }) response: ServerResponse) {
    const result = await this.auth.login(dto);
    response.setHeader('Cache-Control', 'no-store');
    return { accessToken: result.token, tokenType: 'Bearer', expiresAt: result.expiresAt, user: result.user };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất phiên hiện tại; gọi lại vẫn thành công' })
  @ApiResponse({ status: 204, description: 'Đã thu hồi phiên và xóa cookie' })
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: ServerResponse) {
    await this.auth.logout(sessionToken(request));
    clearSessionCookie(response, this.auth.secureCookie);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem tài khoản của phiên hiện tại' })
  me(@Req() request: AuthRequest, @Res({ passthrough: true }) response: ServerResponse) {
    response.setHeader('Cache-Control', 'no-store');
    return { user: request.auth!.user };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đổi mật khẩu, thu hồi tất cả phiên; cần đăng nhập lại' })
  @ApiResponse({ status: 400, description: 'Mật khẩu hiện tại sai hoặc mật khẩu mới không hợp lệ' })
  async changePassword(@Req() request: AuthRequest, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) response: ServerResponse) {
    await this.auth.changePassword(request.auth!, dto);
    clearSessionCookie(response, this.auth.secureCookie);
    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }
}
