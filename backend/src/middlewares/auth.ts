/**
 * 认证中间件
 * 从请求头提取 JWT Token，验证有效性，注入用户信息到请求上下文
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService, JwtPayload } from '../services/AuthService';
import { UserRepository } from '../models/UserRepository';
import { getDatabase } from '../database';

/** 扩展 Express Request 类型，添加用户信息 */
declare global {
  namespace Express {
    interface Request {
      /** 当前认证用户信息 */
      user?: JwtPayload;
    }
  }
}

/**
 * 认证中间件
 * 从 Authorization 请求头提取 Bearer Token，校验有效性
 * 校验通过后将用户信息注入 req.user
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: '未提供认证令牌',
    });
    return;
  }

  const token = authHeader.substring(7);

  const db = getDatabase();
  const userRepo = new UserRepository(db);
  const authService = new AuthService(userRepo);

  const payload = authService.verifyToken(token);
  if (!payload) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: '认证令牌无效或已过期',
    });
    return;
  }

  // 将用户信息注入请求上下文
  req.user = payload;
  next();
}
