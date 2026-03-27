"use strict";
/**
 * 认证中间件
 * 从请求头提取 JWT Token，验证有效性，注入用户信息到请求上下文
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const AuthService_1 = require("../services/AuthService");
const UserRepository_1 = require("../models/UserRepository");
const database_1 = require("../database");
/**
 * 认证中间件
 * 从 Authorization 请求头提取 Bearer Token，校验有效性
 * 校验通过后将用户信息注入 req.user
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            code: 'UNAUTHORIZED',
            message: '未提供认证令牌',
        });
        return;
    }
    const token = authHeader.substring(7);
    const db = (0, database_1.getDatabase)();
    const userRepo = new UserRepository_1.UserRepository(db);
    const authService = new AuthService_1.AuthService(userRepo);
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
//# sourceMappingURL=auth.js.map