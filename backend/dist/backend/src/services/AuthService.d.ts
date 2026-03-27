/**
 * 认证服务
 * 提供登录验证、JWT Token 生成与校验功能
 */
import { UserRepository } from '../models/UserRepository';
import type { User, UserRole, Permission, LoginResponse, CurrentUserResponse } from '../../shared/types';
/** JWT Payload 结构 */
export interface JwtPayload {
    userId: string;
    username: string;
    role: UserRole;
    branchName?: string;
}
export declare class AuthService {
    private userRepo;
    constructor(userRepo: UserRepository);
    /**
     * 登录验证
     * 校验用户名和密码，成功后返回 Token 和用户信息
     */
    login(username: string, password: string): Promise<LoginResponse | null>;
    /**
     * 生成 JWT Token
     */
    generateToken(user: User): string;
    /**
     * 校验 JWT Token，返回解码后的 Payload
     * Token 无效或过期时返回 null
     */
    verifyToken(token: string): JwtPayload | null;
    /**
     * 获取当前用户信息（含权限列表）
     */
    getCurrentUser(userId: string): CurrentUserResponse | null;
    /**
     * 根据角色获取权限列表
     */
    static getPermissions(role: UserRole): Permission[];
    /**
     * 对明文密码进行哈希处理（用于创建用户）
     */
    static hashPassword(password: string): Promise<string>;
}
//# sourceMappingURL=AuthService.d.ts.map