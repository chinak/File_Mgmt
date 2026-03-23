/**
 * 档案查询服务与接口单元测试
 * 验证 ArchiveService.query 的查询逻辑、分页默认值和分支机构数据隔离
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { INIT_SQL } from '../../src/database-init';
import { ArchiveRepository } from '../../src/models/ArchiveRepository';
import { ArchiveService } from '../../src/services/ArchiveService';
import type { ArchiveQueryParams } from '../../shared/types';

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
}

describe('ArchiveService.query', () => {
  let db: Database.Database;
  let service: ArchiveService;

  beforeEach(() => {
    db = createTestDb();
    const repo = new ArchiveRepository(db);
    service = new ArchiveService(repo);
  });

  afterEach(() => {
    db.close();
  });

  it('无数据时应返回空结果', () => {
    const result = service.query({}, 'operator');
    expect(result.total).toBe(0);
    expect(result.records).toHaveLength(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('分页默认值：page=1, pageSize=20', () => {
    insertRecord(db);
    const result = service.query({}, 'operator');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('自定义分页参数应生效', () => {
    // 插入 5 条记录
    for (let i = 0; i < 5; i++) {
      insertRecord(db, { fundAccount: `FA-page-${i}` });
    }
    const result = service.query({ page: 2, pageSize: 2 }, 'operator');
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.total).toBe(5);
    expect(result.records.length).toBeLessThanOrEqual(2);
  });

  it('分支机构用户应自动过滤为本营业部数据', () => {
    insertRecord(db, { fundAccount: 'FA-BJ-1', branchName: '北京营业部' });
    insertRecord(db, { fundAccount: 'FA-SH-1', branchName: '上海营业部' });
    insertRecord(db, { fundAccount: 'FA-BJ-2', branchName: '北京营业部' });

    const result = service.query({}, 'branch', '北京营业部');
    expect(result.total).toBe(2);
    expect(result.records.every(r => r.branchName === '北京营业部')).toBe(true);
  });

  it('分支机构用户即使传入其他营业部也应被覆盖为本营业部', () => {
    insertRecord(db, { fundAccount: 'FA-BJ-3', branchName: '北京营业部' });
    insertRecord(db, { fundAccount: 'FA-SH-2', branchName: '上海营业部' });

    // 分支用户尝试查询上海营业部数据，应被强制覆盖为北京营业部
    const result = service.query({ branchName: '上海营业部' }, 'branch', '北京营业部');
    expect(result.total).toBe(1);
    expect(result.records[0].branchName).toBe('北京营业部');
  });

  it('运营人员可查询所有营业部数据', () => {
    insertRecord(db, { fundAccount: 'FA-OP-1', branchName: '北京营业部' });
    insertRecord(db, { fundAccount: 'FA-OP-2', branchName: '上海营业部' });

    const result = service.query({}, 'operator');
    expect(result.total).toBe(2);
  });

  it('客户姓名模糊匹配', () => {
    insertRecord(db, { fundAccount: 'FA-FZ-1', customerName: '张三丰' });
    insertRecord(db, { fundAccount: 'FA-FZ-2', customerName: '张无忌' });
    insertRecord(db, { fundAccount: 'FA-FZ-3', customerName: '李四' });

    const result = service.query({ customerName: '张' }, 'operator');
    expect(result.total).toBe(2);
  });

  it('资金账号精确匹配', () => {
    insertRecord(db, { fundAccount: 'FA-EXACT-1' });
    insertRecord(db, { fundAccount: 'FA-EXACT-2' });

    const result = service.query({ fundAccount: 'FA-EXACT-1' }, 'operator');
    expect(result.total).toBe(1);
    expect(result.records[0].fundAccount).toBe('FA-EXACT-1');
  });

  it('营业部精确匹配', () => {
    insertRecord(db, { fundAccount: 'FA-BR-1', branchName: '深圳营业部' });
    insertRecord(db, { fundAccount: 'FA-BR-2', branchName: '广州营业部' });

    const result = service.query({ branchName: '深圳营业部' }, 'operator');
    expect(result.total).toBe(1);
    expect(result.records[0].branchName).toBe('深圳营业部');
  });

  it('主流程状态筛选', () => {
    insertRecord(db, { fundAccount: 'FA-ST-1', status: 'pending_shipment' });
    insertRecord(db, { fundAccount: 'FA-ST-2', status: 'in_transit' });

    const result = service.query({ status: 'in_transit' }, 'operator');
    expect(result.total).toBe(1);
    expect(result.records[0].status).toBe('in_transit');
  });

  it('综合部归档状态筛选', () => {
    insertRecord(db, { fundAccount: 'FA-AS-1', archiveStatus: 'pending_transfer' });
    insertRecord(db, { fundAccount: 'FA-AS-2', archiveStatus: 'archived' });

    const result = service.query({ archiveStatus: 'archived' }, 'operator');
    expect(result.total).toBe(1);
  });

  it('合同版本类型筛选', () => {
    insertRecord(db, { fundAccount: 'FA-CVT-1', contractVersionType: 'paper', status: 'pending_shipment' });
    insertRecord(db, {
      fundAccount: 'FA-CVT-2', contractVersionType: 'electronic', status: null,
      archiveStatus: 'archived',
    });

    const result = service.query({ contractVersionType: 'electronic' }, 'operator');
    expect(result.total).toBe(1);
    expect(result.records[0].contractVersionType).toBe('electronic');
  });

  it('开户日期范围查询', () => {
    insertRecord(db, { fundAccount: 'FA-DT-1', openDate: '2024-01-01' });
    insertRecord(db, { fundAccount: 'FA-DT-2', openDate: '2024-06-15' });
    insertRecord(db, { fundAccount: 'FA-DT-3', openDate: '2024-12-31' });

    const result = service.query(
      { openDateStart: '2024-03-01', openDateEnd: '2024-09-30' },
      'operator',
    );
    expect(result.total).toBe(1);
    expect(result.records[0].fundAccount).toBe('FA-DT-2');
  });

  it('组合查询条件应同时生效', () => {
    insertRecord(db, { fundAccount: 'FA-CMB-1', customerName: '王五', branchName: '北京营业部', status: 'in_transit' });
    insertRecord(db, { fundAccount: 'FA-CMB-2', customerName: '王六', branchName: '北京营业部', status: 'pending_shipment' });
    insertRecord(db, { fundAccount: 'FA-CMB-3', customerName: '王七', branchName: '上海营业部', status: 'in_transit' });

    const result = service.query(
      { customerName: '王', branchName: '北京营业部', status: 'in_transit' },
      'operator',
    );
    expect(result.total).toBe(1);
    expect(result.records[0].fundAccount).toBe('FA-CMB-1');
  });

  it('返回结果应包含完整的档案字段', () => {
    insertRecord(db, {
      fundAccount: 'FA-FIELDS-1',
      customerName: '字段测试',
      branchName: '测试营业部',
      contractType: '开户合同',
      openDate: '2024-05-20',
      contractVersionType: 'paper',
      status: 'pending_shipment',
      archiveStatus: 'archive_not_started',
    });

    const result = service.query({ fundAccount: 'FA-FIELDS-1' }, 'operator');
    expect(result.records).toHaveLength(1);
    const record = result.records[0];
    expect(record.customerName).toBe('字段测试');
    expect(record.fundAccount).toBe('FA-FIELDS-1');
    expect(record.branchName).toBe('测试营业部');
    expect(record.contractType).toBe('开户合同');
    expect(record.openDate).toBe('2024-05-20');
    expect(record.contractVersionType).toBe('paper');
    expect(record.status).toBe('pending_shipment');
    expect(record.archiveStatus).toBe('archive_not_started');
  });
});
