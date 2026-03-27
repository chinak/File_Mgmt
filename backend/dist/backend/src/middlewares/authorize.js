"use strict";
/**
 * 权限校验中间件
 * 校验当前用户角色是否具有所需权限，需在 authenticate 中间件之后使用
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = authorize;
const AuthService_1 = require("../services/AuthService");
/**
 * 权限校验中间件工厂函数
 * 接收所需权限列表，返回中间件函数
 * 校验当前用户角色是否具有所有所需权限
 * @param requiredPermissions - 执行该操作所需的权限列表
 */
function authorize(...requiredPermissions) {
    return (req, res, next) => {
        // 用户信息由 authenticate 中间件注入
        const user = req.user;
        if (!user) {
            res.status(401).json({
                code: 'UNAUTHORIZED',
                message: '未提供认证令牌',
            });
            return;
        }
        // 获取当前用户角色的权限列表
        const userPermissions = AuthService_1.AuthService.getPermissions(user.role);
        // 校验用户是否具有所有所需权限
        const hasAllPermissions = requiredPermissions.every((perm) => userPermissions.includes(perm));
        if (!hasAllPermissions) {
            res.status(403).json({
                code: 'PERMISSION_DENIED',
                message: '权限不足',
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=authorize.js.map