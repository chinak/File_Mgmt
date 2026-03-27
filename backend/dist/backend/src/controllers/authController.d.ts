/**
 * 认证控制器
 * 处理登录和获取当前用户信息的请求
 */
import { Request, Response } from 'express';
/**
 * POST /api/auth/login
 * 用户登录，返回 JWT Token 和用户信息
 */
export declare function login(req: Request, res: Response): Promise<void>;
/**
 * GET /api/auth/me
 * 获取当前登录用户信息（含权限列表）
 * 需要认证中间件前置
 */
export declare function me(req: Request, res: Response): void;
//# sourceMappingURL=authController.d.ts.map