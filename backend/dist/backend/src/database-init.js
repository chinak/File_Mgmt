"use strict";
/**
 * 数据库表结构初始化脚本
 * 创建 users、archive_records、status_change_logs 三张表
 * 使用 TEXT + CHECK 约束替代 ENUM 类型
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INIT_SQL = void 0;
/** 初始化 SQL 语句 */
exports.INIT_SQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('operator', 'branch', 'general_affairs')),
  branch_name   TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- 档案记录表（双状态字段：status + archive_status，无 branch_return_status）
CREATE TABLE IF NOT EXISTS archive_records (
  id                    TEXT PRIMARY KEY,
  customer_name         TEXT NOT NULL,
  fund_account          TEXT NOT NULL UNIQUE,
  branch_name           TEXT NOT NULL,
  contract_type         TEXT NOT NULL,
  open_date             TEXT NOT NULL,
  contract_version_type TEXT NOT NULL CHECK(contract_version_type IN ('electronic', 'paper')),
  status                TEXT CHECK(status IN (
    'pending_shipment', 'in_transit', 'hq_received',
    'review_passed', 'review_rejected',
    'pending_return', 'return_in_transit', 'branch_received',
    'completed'
  )),
  archive_status        TEXT NOT NULL DEFAULT 'archive_not_started' CHECK(archive_status IN (
    'archive_not_started', 'pending_transfer', 'pending_archive', 'archived'
  )),
  scan_file_url         TEXT,
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now'))
);

-- 档案记录表索引
CREATE INDEX IF NOT EXISTS idx_fund_account ON archive_records(fund_account);
CREATE INDEX IF NOT EXISTS idx_branch_name ON archive_records(branch_name);
CREATE INDEX IF NOT EXISTS idx_status ON archive_records(status);
CREATE INDEX IF NOT EXISTS idx_archive_status ON archive_records(archive_status);
CREATE INDEX IF NOT EXISTS idx_contract_version_type ON archive_records(contract_version_type);

-- 状态变更日志表
CREATE TABLE IF NOT EXISTS status_change_logs (
  id              TEXT PRIMARY KEY,
  archive_id      TEXT NOT NULL REFERENCES archive_records(id),
  status_field    TEXT NOT NULL,
  previous_value  TEXT,
  new_value       TEXT NOT NULL,
  action          TEXT NOT NULL,
  operator_id     TEXT NOT NULL,
  operator_name   TEXT NOT NULL,
  operated_at     TEXT DEFAULT (datetime('now'))
);

-- 状态变更日志表索引
CREATE INDEX IF NOT EXISTS idx_archive_id ON status_change_logs(archive_id);
`;
//# sourceMappingURL=database-init.js.map