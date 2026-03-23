/**
 * 认证模块单元测试
 * 覆盖 AuthService、认证中间件、authController
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '../../src/database';
import { UserRepository } from '../../src/models/UserRepository';
import { AuthService } from '../../src/services/AuthService';
import type Database from 'better-sqlite3';

let db: Database.Database;
let userRepo: UserRepository;
let authService: AuthService;

/** 测试用户密码 */
const TEST_PASSWORD = 'test123';

/** 插入测试用户 */
function insertUser(
  username: string,
  role: string,
  branchName: string | null = null
): string {
  const id = uuidv4();
  const hash = bcrypt.hashSync(TEST_PASSWORD, 10);
  db.prepare(
    'INSERT INTO users (id, username, password_hash, role, branch_name) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, hash, role, branchName);
  return id;
}

beforeEach(() => {
  db = createDatabase(':memory:');
  userRepo = new UserRepository(db);
  authService = new AuthService(userRepo);
});

afterEach(() => {
  db.close();
});

describe('AuthService', () => {
  describe('login', () => {
    it('正确的用户名和密码应返回 Token 和用户信息', async () => {
      const userId = insertUser('operator', 'operator');
      const result = await authService.login('operator', TEST_PASSWORD);

      expect(result).not.toBeNull();
      expect(result!.token).toBeTruthy();
      expect(result!.user.id).toBe(userId);
      expect(result!.user.username).toBe('operator');
      expect(result!.user.role).toBe('operator');
    });

    it('分支机构用户登录应返回 branchName', async () => {
      insertUser('branch_sh', 'branch', '上海营业部');
      const result = await authService.login('branch_sh', TEST_PASSWORD);

      expect(result).not.toBeNull();
      expect(result!.user.branchName).toBe('上海营业部');
    });

    it('用户名不存在应返回 null', async () => {
      const result = await authService.login('nonexistent', TEST_PASSWORD);
      expect(result).toBeNull();
    });

    it('密码错误应返回 null', async () => {
      insertUser('operator', 'operator');
      const result = await authService.login('operator', 'wrong_password');
      expect(result).toBeNull();
    });
  });

  describe('generateToken / verifyToken', () => {
    it('生成的 Token 应能被正确校验', () => {
      const userId = insertUser('operator', 'operator');
      const user = userRepo.findById(userId)!;
      const token = authService.generateToken(user);

      const payload = authService.verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe(userId);
      expect(payload!.username).toBe('operator');
      expect(payload!.role).toBe('operator');
    });

    it('无效 Token 应返回 null', () => {
      const payload = authService.verifyToken('invalid-token');
      expect(payload).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('应返回用户信息和权限列表', () => {
      const userId = insertUser('operator', 'operator');
      const currentUser = authService.getCurrentUser(userId);

      expect(currentUser).not.toBeNull();
      expect(currentUser!.id).toBe(userId);
      expect(currentUser!.permissions).toContain('import');
      expect(currentUser!.permissions).toContain('search');
      expect(currentUser!.permissions).toContain('review');
      expect(currentUser!.permissions).toContain('confirm_received');
      expect(currentUser!.permissions).toContain('review_reject');
      expect(currentUser!.permissions).toContain('confirm_shipped_back');
    });

    it('分支机构用户应有 confirm_shipment 权限', () => {
      const userId = insertUser('branch_sh', 'branch', '上海营业部');
      const currentUser = authService.getCurrentUser(userId);

      expect(currentUser!.permissions).toContain('confirm_shipment');
      expect(currentUser!.permissions).toContain('view_own_archives');
      expect(currentUser!.permissions).not.toContain('import');
    });

    it('综合部用户应有 confirm_archive 权限', () => {
      const userId = insertUser('general_affairs', 'general_affairs');
      const currentUser = authService.getCurrentUser(userId);

      expect(currentUser!.permissions).toContain('confirm_archive');
      expect(currentUser!.permissions).not.toContain('import');
    });

    it('用户不存在应返回 null', () => {
      const currentUser = authService.getCurrentUser('nonexistent-id');
      expect(currentUser).toBeNull();
    });
  });

  describe('getPermissions', () => {
    it('运营人员应有 10 项权限', () => {
      const perms = AuthService.getPermissions('operator');
      expect(perms).toHaveLength(10);
      expect(perms).toContain('confirm_received');
      expect(perms).toContain('review_reject');
      expect(perms).toContain('confirm_shipped_back');
    });

    it('分支机构应有 3 项权限', () => {
      const perms = AuthService.getPermissions('branch');
      expect(perms).toHaveLength(3);
    });

    it('综合部应有 1 项权限', () => {
      const perms = AuthService.getPermissions('general_affairs');
      expect(perms).toHaveLength(1);
    });
  });

  describe('hashPassword', () => {
    it('哈希后的密码应能通过 bcrypt 校验', async () => {
      const hash = await AuthService.hashPassword('mypassword');
      const isValid = await bcrypt.compare('mypassword', hash);
      expect(isValid).toBe(true);
    });
  });
});
