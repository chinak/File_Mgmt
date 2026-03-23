/**
 * 认证控制器
 * 处理登录和获取当前用户信息的请求
 */

import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { UserRepository } from '../models/UserRepository';
import { getDatabase } from '../database';
import type { LoginRequest } from '../../shared/types';

/**
 * POST /api/auth/login
 * 用户登录，返回 JWT Token 和用户信息
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as LoginRequest;

  // 参数校验
  if (!username || !password) {
    res.status(400).json({
      code: 'INVALID_REQUEST',
      message: '用户名和密码不能为空',
    });
    return;
  }

  const db = getDatabase();
  const userRepo = new UserRepository(db);
  const authService = new AuthService(userRepo);

  const result = await authService.login(username, password);

  if (!result) {
    res.status(401).json({
      code: 'LOGIN_FAILED',
      message: '用户名或密码错误',
    });
    return;
  }

  res.json(result);
}

/**
 * GET /api/auth/me
 * 获取当前登录用户信息（含权限列表）
 * 需要认证中间件前置
 */
export function me(req: Request, res: Response): void {
  const user = req.user;

  if (!user) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: '未认证',
    });
    return;
  }

  const db = getDatabase();
  const userRepo = new UserRepository(db);
  const authService = new AuthService(userRepo);

  const currentUser = authService.getCurrentUser(user.userId);

  if (!currentUser) {
    res.status(404).json({
      code: 'USER_NOT_FOUND',
      message: '用户不存在',
    });
    return;
  }

  res.json(currentUser);
}
