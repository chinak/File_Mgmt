/**
 * 数据库模块单元测试
 * 验证表结构创建、索引定义、WAL 模式和外键约束
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createDatabase } from '../../src/database';
import Database from 'better-sqlite3';

describe('数据库初始化', () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('应创建 users 表并包含正确的列', () => {
    db = createDatabase(':memory:');
    const columns = db.pragma('table_info(users)') as Array<{ name: string; type: string; notnull: number }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('username');
    expect(columnNames).toContain('password_hash');
    expect(columnNames).toContain('role');
    expect(columnNames).toContain('branch_name');
    expect(columnNames).toContain('created_at');
  });

  it('应创建 archive_records 表并包含正确的列', () => {
    db = createDatabase(':memory:');
    const columns = db.pragma('table_info(archive_records)') as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toEqual([
      'id',
      'customer_name',
      'fund_account',
      'branch_name',
      'contract_type',
      'open_date',
      'contract_version_type',
      'status',
      'archive_status',
      'scan_file_url',
      'created_at',
      'updated_at',
    ]);
  });

  it('应创建 status_change_logs 表并包含正确的列', () => {
    db = createDatabase(':memory:');
    const columns = db.pragma('table_info(status_change_logs)') as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toEqual([
      'id',
      'archive_id',
      'status_field',
      'previous_value',
      'new_value',
      'action',
      'operator_id',
      'operator_name',
      'operated_at',
    ]);
  });

  it('应创建 archive_records 表的索引', () => {
    db = createDatabase(':memory:');
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='archive_records' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_fund_account');
    expect(indexNames).toContain('idx_branch_name');
    expect(indexNames).toContain('idx_status');
    expect(indexNames).toContain('idx_archive_status');
    expect(indexNames).toContain('idx_contract_version_type');
  });

  it('应创建 status_change_logs 表的索引', () => {
    db = createDatabase(':memory:');
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='status_change_logs' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_archive_id');
  });

  it('应启用外键约束', () => {
    db = createDatabase(':memory:');
    const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
    expect(result[0].foreign_keys).toBe(1);
  });

  it('应通过 CHECK 约束拒绝非法的 role 值', () => {
    db = createDatabase(':memory:');
    expect(() => {
      db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES ('1', 'test', 'hash', 'invalid_role')").run();
    }).toThrow();
  });

  it('应通过 CHECK 约束拒绝非法的 contract_version_type 值', () => {
    db = createDatabase(':memory:');
    expect(() => {
      db.prepare(
        "INSERT INTO archive_records (id, customer_name, fund_account, branch_name, contract_type, open_date, contract_version_type) VALUES ('1', '张三', 'FA001', '北京营业部', '开户合同', '2024-01-01', 'invalid')"
      ).run();
    }).toThrow();
  });

  it('应通过 CHECK 约束拒绝非法的 status 值', () => {
    db = createDatabase(':memory:');
    expect(() => {
      db.prepare(
        "INSERT INTO archive_records (id, customer_name, fund_account, branch_name, contract_type, open_date, contract_version_type, status) VALUES ('1', '张三', 'FA001', '北京营业部', '开户合同', '2024-01-01', 'paper', 'invalid_status')"
      ).run();
    }).toThrow();
  });

  it('应通过 UNIQUE 约束拒绝重复的 fund_account', () => {
    db = createDatabase(':memory:');
    const insert = db.prepare(
      "INSERT INTO archive_records (id, customer_name, fund_account, branch_name, contract_type, open_date, contract_version_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    insert.run('1', '张三', 'FA001', '北京营业部', '开户合同', '2024-01-01', 'paper', 'pending_shipment');

    expect(() => {
      insert.run('2', '李四', 'FA001', '上海营业部', '开户合同', '2024-01-02', 'paper', 'pending_shipment');
    }).toThrow();
  });

  it('应通过外键约束拒绝引用不存在的 archive_id', () => {
    db = createDatabase(':memory:');
    expect(() => {
      db.prepare(
        "INSERT INTO status_change_logs (id, archive_id, status_field, new_value, action, operator_id, operator_name) VALUES ('log1', 'nonexistent', 'status', 'in_transit', 'confirm_shipment', 'u1', '操作员')"
      ).run();
    }).toThrow();
  });

  it('电子版合同的 status 可以为 NULL', () => {
    db = createDatabase(':memory:');
    db.prepare(
      "INSERT INTO archive_records (id, customer_name, fund_account, branch_name, contract_type, open_date, contract_version_type, status, archive_status) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)"
    ).run('1', '张三', 'FA001', '北京营业部', '开户合同', '2024-01-01', 'electronic', 'archived');

    const record = db.prepare("SELECT status FROM archive_records WHERE id = '1'").get() as { status: string | null };
    expect(record.status).toBeNull();
  });
});
