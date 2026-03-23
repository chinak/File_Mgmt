/**
 * 认证服务
 * 提供登录验证、JWT Token 生成与校验功能
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../models/UserRepository';
import type { User, UserRole, Permission, LoginResponse, CurrentUserResponse } from '../../shared/types';

/** JWT 密钥，优先从环境变量读取 */
const JWT_SECRET = process.env.JWT_SECRET || 'archive-management-jwt-secret-key';

/** Token 过期时间（默认 8 小时） */
const TOKEN_EXPIRES_IN = '8h';

/** JWT Payload 结构 */
export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  branchName?: string;
}

/** 角色-权限映射表 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  operator: ['import', 'search', 'confirm_received', 'review', 'review_reject', 'return_branch', 'confirm_shipped_back', 'transfer_general', 'upload_scan', 'ocr'],
  branch: ['view_own_archives', 'confirm_shipment', 'confirm_return_received'],
  general_affairs: ['confirm_archive'],
};

export class AuthService {
  private userRepo: UserRepository;

  constructor(userRepo: UserRepository) {
    this.userRepo = userRepo;
  }

  /**
   * 登录验证
   * 校验用户名和密码，成功后返回 Token 和用户信息
   */
  async login(username: string, password: string): Promise<LoginResponse | null> {
    const user = this.userRepo.findByUsername(username);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
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
  generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      branchName: user.branchName,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
  }

  /**
   * 校验 JWT Token，返回解码后的 Payload
   * Token 无效或过期时返回 null
   */
  verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * 获取当前用户信息（含权限列表）
   */
  getCurrentUser(userId: string): CurrentUserResponse | null {
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
  static getPermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * 对明文密码进行哈希处理（用于创建用户）
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
