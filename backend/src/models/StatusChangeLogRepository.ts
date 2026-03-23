/**
 * 状态变更日志数据访问层
 * 提供日志写入与按档案 ID 查询功能
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { StatusChangeLog, TransitionAction } from '../../shared/types';

/** 数据库行类型（snake_case 字段名） */
interface StatusChangeLogRow {
  id: string;
  archive_id: string;
  status_field: string;
  previous_value: string | null;
  new_value: string;
  action: string;
  operator_id: string;
  operator_name: string;
  operated_at: string;
}

/** 将数据库行转换为 StatusChangeLog 接口 */
function rowToLog(row: StatusChangeLogRow): StatusChangeLog {
  return {
    id: row.id,
    archiveId: row.archive_id,
    statusField: row.status_field,
    previousValue: row.previous_value,
    newValue: row.new_value,
    action: row.action as TransitionAction | 'create',
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    operatedAt: row.operated_at,
  };
}

/** 创建状态变更日志的输入参数 */
export interface CreateStatusChangeLogInput {
  archiveId: string;
  statusField: string;
  previousValue: string | null;
  newValue: string;
  action: TransitionAction | 'create';
  operatorId: string;
  operatorName: string;
}

export class StatusChangeLogRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** 写入状态变更日志 */
  create(input: CreateStatusChangeLogInput): StatusChangeLog {
    const id = uuidv4();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    this.db.prepare(`
      INSERT INTO status_change_logs (
        id, archive_id, status_field, previous_value, new_value,
        action, operator_id, operator_name, operated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.archiveId,
      input.statusField,
      input.previousValue,
      input.newValue,
      input.action,
      input.operatorId,
      input.operatorName,
      now,
    );

    return this.findById(id)!;
  }

  /** 根据日志 ID 查询 */
  findById(id: string): StatusChangeLog | null {
    const row = this.db.prepare(
      'SELECT * FROM status_change_logs WHERE id = ?'
    ).get(id) as StatusChangeLogRow | undefined;

    return row ? rowToLog(row) : null;
  }

  /** 根据档案 ID 查询所有状态变更日志（按时间倒序） */
  findByArchiveId(archiveId: string): StatusChangeLog[] {
    const rows = this.db.prepare(
      'SELECT * FROM status_change_logs WHERE archive_id = ? ORDER BY operated_at DESC'
    ).all(archiveId) as StatusChangeLogRow[];

    return rows.map(rowToLog);
  }
}
