"use strict";
/**
 * 认证服务
 * 提供登录验证、JWT Token 生成与校验功能
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
/** JWT 密钥，优先从环境变量读取 */
const JWT_SECRET = process.env.JWT_SECRET || 'archive-management-jwt-secret-key';
/** Token 过期时间（默认 8 小时） */
const TOKEN_EXPIRES_IN = '8h';
/** 角色-权限映射表 */
const ROLE_PERMISSIONS = {
    operator: ['import', 'search', 'confirm_received', 'review', 'review_reject', 'return_branch', 'confirm_shipped_back', 'transfer_general', 'upload_scan', 'ocr'],
    branch: ['view_own_archives', 'confirm_shipment', 'confirm_return_received'],
    general_affairs: ['confirm_archive'],
};
class AuthService {
    constructor(userRepo) {
        this.userRepo = userRepo;
    }
    /**
     * 登录验证
     * 校验用户名和密码，成功后返回 Token 和用户信息
     */
    async login(username, password) {
        const user = this.userRepo.findByUsername(username);
        if (!user) {
            return null;
        }
        const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            return null;
        }
        const token = this.generateToken(user);
        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                branchName: user.branchName,
            },
        };
    }
    /**
     * 生成 JWT Token
     */
    generateToken(user) {
        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            branchName: user.branchName,
        };
        return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
    }
    /**
     * 校验 JWT Token，返回解码后的 Payload
     * Token 无效或过期时返回 null
     */
    verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            return decoded;
        }
        catch {
            return null;
        }
    }
    /**
     * 获取当前用户信息（含权限列表）
     */
    getCurrentUser(userId) {
        const user = this.userRepo.findById(userId);
        if (!user) {
            return null;
        }
        return {
            id: user.id,
            username: user.username,
            role: user.role,
            branchName: user.branchName,
            permissions: AuthService.getPermissions(user.role),
        };
    }
    /**
     * 根据角色获取权限列表
     */
    static getPermissions(role) {
        return ROLE_PERMISSIONS[role] || [];
    }
    /**
     * 对明文密码进行哈希处理（用于创建用户）
     */
    static async hashPassword(password) {
        return bcryptjs_1.default.hash(password, 10);
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map