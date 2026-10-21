import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import { ok } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';
import { getRefreshCookieOptions } from '../../utils/tokens.js';

export async function login(req: Request, res: Response) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  const { accessToken, refreshToken, expiresIn, user } = await authService.login({
    username: req.valid.body.username,
    password: req.valid.body.password,
    ip,
    userAgent,
  });

  res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

  return ok(res, {
    code: SUCCESS_CODES.AUTH_LOGGED_IN,
    message: 'Signed in successfully',
    data: {
      accessToken,
      expiresIn,
      user,
    },
  });
}

export async function refresh(req: Request, res: Response) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const incomingRefreshToken = req.cookies?.refreshToken;

  const { accessToken, refreshToken, expiresIn } = await authService.refresh({
    refreshToken: incomingRefreshToken,
    ip,
    userAgent,
  });

  res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

  return ok(res, {
    code: SUCCESS_CODES.AUTH_REFRESHED,
    message: 'Token refreshed successfully',
    data: {
      accessToken,
      expiresIn,
    },
  });
}

export async function logout(req: Request, res: Response) {
  const incomingRefreshToken = req.cookies?.refreshToken;

  await authService.logout({ refreshToken: incomingRefreshToken });
  res.clearCookie('refreshToken', getRefreshCookieOptions());
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('userRole', { path: '/' });
  res.clearCookie('token', { path: '/' });

  return ok(res, {
    code: SUCCESS_CODES.AUTH_LOGGED_OUT,
    message: 'Signed out successfully',
    data: null,
  });
}

export async function changePassword(req: Request, res: Response) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const currentRefreshToken = req.cookies?.refreshToken;

  const { accessToken, refreshToken, expiresIn } = await authService.changePassword({
    userId: req.user!.userId,
    currentPassword: req.valid.body.currentPassword,
    newPassword: req.valid.body.newPassword,
    currentRefreshToken,
    ip,
    userAgent,
  });

  res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

  return ok(res, {
    code: SUCCESS_CODES.AUTH_PASSWORD_CHANGED,
    message: 'Password changed successfully',
    data: {
      accessToken,
      expiresIn,
    },
  });
}

export async function me(req: Request, res: Response) {
  const profile = await authService.getMe(req.user!.userId);

  return ok(res, {
    code: SUCCESS_CODES.USER_FETCHED,
    message: 'Current authenticated user profile',
    data: profile,
  });
}
