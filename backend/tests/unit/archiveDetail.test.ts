/**
 * 档案详情接口单元测试
 * 验证 getArchiveDetail 处理器的正确行为
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { INIT_SQL } from '../../src/database-init';
import type { Request, Response } from 'express';

/** 创建内存数据库并初始化表结构 */
function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(INIT_SQL);
  return db;
}

/** 插入测试档案记录 */
function insertRecord(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    customerName: string;
    fundAccount: string;
    branchName: string;
    contractType: string;
    openDate: string;
    contractVersionType: string;
    status: string | null;
    archiveStatus: string;
  }> = {},
) {
  const defaults = {
    id: `id-${Math.random().toString(36).slice(2, 10)}`,
    customerName: '测试客户',
    fundAccount: `FA-${Math.random().toString(36).slice(2, 10)}`,
    branchName: '北京营业部',
    contractType: '开户合同',
    openDate: '2024-01-15',
    contractVersionType: 'paper',
    status: 'pending_shipment',
    archiveStatus: 'archive_not_started',
  };
  const r = { ...defaults, ...overrides };
  db.prepare(`
    INSERT INTO archive_records (id, customer_name, fund_account, branch_name, contract_type,
      open_date, contract_version_type, status, archive_status,
      created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(r.id, r.customerName, r.fundAccount, r.branchName, r.contractType,
    r.openDate, r.contractVersionType, r.status, r.archiveStatus);
  return r.id;
}

/** 插入状态变更日志 */
function insertLog(
  db: Database.Database,
  archiveId: string,
  overrides: Partial<{
    id: string;
    statusField: string;
    previousValue: string | null;
    newValue: string;
    action: string;
    operatorId: string;
    operatorName: string;
    operatedAt: string;
  }> = {},
) {
  const defaults = {
    id: `log-${Math.random().toString(36).slice(2, 10)}`,
    statusField: 'status',
    previousValue: null,
    newValue: 'pending_shipment',
    action: 'create',
    operatorId: 'user-1',
    operatorName: '操作员',
    operatedAt: '2024-01-15 10:00:00',
  };
  const l = { ...defaults, ...overrides };
  db.prepare(`
    INSERT INTO status_change_logs (id, archive_id, status_field, previous_value, new_value,
      action, operator_id, operator_name, operated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(l.id, archiveId, l.statusField, l.previousValue, l.newValue,
    l.action, l.operatorId, l.operatorName, l.operatedAt);
}

/** 创建模拟 Response 对象 */
function createMockRes(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis() as any,
    json: vi.fn().mockReturnThis() as any,
  };
  return res as Response;
}

describe('getArchiveDetail', () => {
  let db: Database.Database;
  let getArchiveDetail: typeof import('../../src/controllers/archiveController').getArchiveDetail;

  beforeEach(async () => {
    db = createTestDb();
    // mock getDatabase 返回内存数据库
    vi.doMock('../../src/database', () => ({
      getDatabase: () => db,
    }));
    const mod = await import('../../src/controllers/archiveController');
    getArchiveDetail = mod.getArchiveDetail;
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('未认证时应返回 401', () => {
    const req = { params: { id: 'any-id' }, user: undefined } as unknown as Request;
    const res = createMockRes();

    getArchiveDetail(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '未提供认证令牌' }),
    );
  });

  it('档案不存在时应返回 404', () => {
    const req = {
      params: { id: 'non-existent-id' },
      user: { userId: 'u1', username: 'admin', role: 'operator' },
    } as unknown as Request;
    const res = createMockRes();

    getArchiveDetail(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '档案记录不存在' }),
    );
  });

  it('应返回档案记录完整信息', () => {
    const archiveId = insertRecord(db, {
      id: 'archive-detail-1',
      customerName: '张三',
      fundAccount: 'FA-DETAIL-1',
      branchName: '上海营业部',
      contractType: '开户合同',
      openDate: '2024-03-20',
    });

    const req = {
      params: { id: archiveId },
      user: { userId: 'u1', username: 'admin', role: 'operator' },
    } as unknown as Request;
    const res = createMockRes();

    getArchiveDetail(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({
          id: archiveId,
          customerName: '张三',
          fundAccount: 'FA-DETAIL-1',
          branchName: '上海营业部',
          contractType: '开户合同',
          openDate: '2024-03-20',
          contractVersionType: 'paper',
          status: 'pending_shipment',
          archiveStatus: 'archive_not_started',
        }),
      }),
    );
  });

  it('无状态变更历史时 statusHistory 应为空数组', () => {
    const archiveId = insertRecord(db, { id: 'archive-no-logs' });

    const req = {
      params: { id: archiveId },
      user: { userId: 'u1', username: 'admin', role: 'operator' },
    } as unknown as Request;
    const res = createMockRes();

    getArchiveDetail(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusHistory: [],
      }),
    );
  });

  it('应返回状态变更历史（按时间倒序）', () => {
    const archiveId = insertRecord(db, { id: 'archive-with-logs' });

    // 插入多条日志，时间不同
    insertLog(db, archiveId, {
      id: 'log-1',
      statusField: 'status',
      previousValue: null,
      newValue: 'pending_shipment',
      action: 'create',
      operatedAt: '2024-01-10 08:00:00',
    });
    insertLog(db, archiveId, {
      id: 'log-2',
      statusField: 'status',
      previousValue: 'pending_shipment',
      newValue: 'in_transit',
      action: 'confirm_shipment',
      operatedAt: '2024-01-15 14:30:00',
    });
    insertLog(db, archiveId, {
      id: 'log-3',
      statusField: 'status',
      previousValue: 'in_transit',
      newValue: 'review_passed',
      action: 'review_pass',
      operatedAt: '2024-01-20 09:00:00',
    });

    const req = {
      params: { id: archiveId },
      user: { userId: 'u1', username: 'admin', role: 'operator' },
    } as unknown as Request;
    const res = createMockRes();

    getArchiveDetail(req, res);

    const response = (res.json as any).mock.calls[0][0];
    expect(response.statusHistory).toHaveLength(3);
    // 按时间倒序：最新的在前
    expect(response.statusHistory[0].id).toBe('log-3');
    expect(response.statusHistory[1].id).toBe('log-2');
    expect(response.statusHistory[2].id).toBe('log-1');
  });

  it('不应返回其他档案的状态变更历史', () => {
    const archiveId1 = insertRecord(db, { id: 'archive-a', fundAccount: 'FA-A' });
    const archiveId2 = insertRecord(db, { id: 'archive-b', fundAccount: 'FA-B' });

    insertLog(db, archiveId1, { id: 'log-a1' });
    insertLog(db, archiveId2, { id: 'log-b1' });

    const req = {
      params: { id: archiveId1 },
      user: { userId: 'u1', username: 'admin', role: 'operator' },
    } as unknown as Request;
    const res = createMockRes();

    getArchiveDetail(req, res);

    const response = (res.json as any).mock.calls[0][0];
    expect(response.statusHistory).toHaveLength(1);
    expect(response.statusHistory[0].archiveId).toBe(archiveId1);
  });
});
