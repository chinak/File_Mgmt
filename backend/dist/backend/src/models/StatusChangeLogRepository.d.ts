/**
 * 状态变更日志数据访问层
 * 提供日志写入与按档案 ID 查询功能
 */
import Database from 'better-sqlite3';
import type { StatusChangeLog, TransitionAction } from '../../shared/types';
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
export declare class StatusChangeLogRepository {
    private db;
    constructor(db: Database.Database);
    /** 写入状态变更日志 */
    create(input: CreateStatusChangeLogInput): StatusChangeLog;
    /** 根据日志 ID 查询 */
    findById(id: string): StatusChangeLog | null;
    /** 根据档案 ID 查询所有状态变更日志（按时间倒序） */
    findByArchiveId(archiveId: string): StatusChangeLog[];
}
//# sourceMappingURL=StatusChangeLogRepository.d.ts.map