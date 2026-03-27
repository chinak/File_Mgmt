/**
 * 认证中间件
 * 从请求头提取 JWT Token，验证有效性，注入用户信息到请求上下文
 */
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '../services/AuthService';
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
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map