"use strict";
/**
 * 状态变更日志数据访问层
 * 提供日志写入与按档案 ID 查询功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusChangeLogRepository = void 0;
const uuid_1 = require("uuid");
/** 将数据库行转换为 StatusChangeLog 接口 */
function rowToLog(row) {
    return {
        id: row.id,
        archiveId: row.archive_id,
        statusField: row.status_field,
        previousValue: row.previous_value,
        newValue: row.new_value,
        action: row.action,
        operatorId: row.operator_id,
        operatorName: row.operator_name,
        operatedAt: row.operated_at,
    };
}
class StatusChangeLogRepository {
    constructor(db) {
        this.db = db;
    }
    /** 写入状态变更日志 */
    create(input) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        this.db.prepare(`
      INSERT INTO status_change_logs (
        id, archive_id, status_field, previous_value, new_value,
        action, operator_id, operator_name, operated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.archiveId, input.statusField, input.previousValue, input.newValue, input.action, input.operatorId, input.operatorName, now);
        return this.findById(id);
    }
    /** 根据日志 ID 查询 */
    findById(id) {
        const row = this.db.prepare('SELECT * FROM status_change_logs WHERE id = ?').get(id);
        return row ? rowToLog(row) : null;
    }
    /** 根据档案 ID 查询所有状态变更日志（按时间倒序） */
    findByArchiveId(archiveId) {
        const rows = this.db.prepare('SELECT * FROM status_change_logs WHERE archive_id = ? ORDER BY operated_at DESC').all(archiveId);
        return rows.map(rowToLog);
    }
}
exports.StatusChangeLogRepository = StatusChangeLogRepository;
//# sourceMappingURL=StatusChangeLogRepository.js.map