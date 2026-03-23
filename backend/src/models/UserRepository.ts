/**
 * 用户数据访问层
 * 提供用户查询功能
 */

import Database from 'better-sqlite3';
import type { User, UserRole } from '../../shared/types';

/** 数据库行类型（snake_case 字段名） */
interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  branch_name: string | null;
  created_at: string;
}

/** 将数据库行转换为 User 接口 */
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    branchName: row.branch_name ?? undefined,
    createdAt: row.created_at,
  };
}

export class UserRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** 根据用户名查询用户 */
  findByUsername(username: string): User | null {
    const row = this.db.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).get(username) as UserRow | undefined;

    return row ? rowToUser(row) : null;
  }

  /** 根据 ID 查询用户 */
  findById(id: string): User | null {
    const row = this.db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).get(id) as UserRow | undefined;

    return row ? rowToUser(row) : null;
  }
}
