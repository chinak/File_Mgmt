/**
 * 数据访问层（Repository）单元测试
 * 验证 ArchiveRepository、UserRepository、StatusChangeLogRepository 的 CRUD 操作
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase } from '../../src/database';
import { ArchiveRepository } from '../../src/models/ArchiveRepository';
import { UserRepository } from '../../src/models/UserRepository';
import { StatusChangeLogRepository } from '../../src/models/StatusChangeLogRepository';

describe('ArchiveRepository', () => {
  let db: Database.Database;
  let repo: ArchiveRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new ArchiveRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  // 辅助函数：插入纸质版档案记录
  function createPaperArchive(fundAccount: string, branchName = '北京营业部') {
    return repo.create({
      customerName: '张三',
      fundAccount,
      branchName,
      contractType: '开户合同',
      openDate: '2024-01-15',
      contractVersionType: 'paper',
      status: 'pending_shipment',
      archiveStatus: 'archive_not_started',
    });
  }

  it('应创建纸质版档案记录并返回完整数据', () => {
    const record = createPaperArchive('FA001');

    expect(record.id).toBeDefined();
    expect(record.customerName).toBe('张三');
    expect(record.fundAccount).toBe('FA001');
    expect(record.branchName).toBe('北京营业部');
    expect(record.contractType).toBe('开户合同');
    expect(record.openDate).toBe('2024-01-15');
    expect(record.contractVersionType).toBe('paper');
    expect(record.status).toBe('pending_shipment');
    expect(record.archiveStatus).toBe('archive_not_started');
    expect(record.createdAt).toBeDefined();
    expect(record.updatedAt).toBeDefined();
  });

  it('应创建电子版档案记录，status 为 null', () => {
    const record = repo.create({
      customerName: '李四',
      fundAccount: 'FA002',
      branchName: '上海营业部',
      contractType: '开户合同',
      openDate: '2024-02-01',
      contractVersionType: 'electronic',
      status: null,
      archiveStatus: 'archived',
    });

    expect(record.status).toBeNull();
    expect(record.archiveStatus).toBe('archived');
  });

  it('应通过 ID 查询档案记录', () => {
    const created = createPaperArchive('FA003');
    const found = repo.findById(created.id);

    expect(found).not.toBeNull();
    expect(found!.fundAccount).toBe('FA003');
  });

  it('查询不存在的 ID 应返回 null', () => {
    const found = repo.findById('nonexistent-id');
    expect(found).toBeNull();
  });

  it('应通过资金账号查询档案记录', () => {
    createPaperArchive('FA004');
    const found = repo.findByFundAccount('FA004');

    expect(found).not.toBeNull();
    expect(found!.fundAccount).toBe('FA004');
  });

  it('查询不存在的资金账号应返回 null', () => {
    const found = repo.findByFundAccount('NONEXISTENT');
    expect(found).toBeNull();
  });

  it('应更新档案记录的状态字段', () => {
    const created = createPaperArchive('FA005');
    const updated = repo.update(created.id, {
      status: 'in_transit',
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('in_transit');
    // 其他字段不变
    expect(updated!.archiveStatus).toBe('archive_not_started');
  });

  it('应同时更新多个字段', () => {
    const created = createPaperArchive('FA006');
    const updated = repo.update(created.id, {
      status: 'review_passed',
      archiveStatus: 'pending_transfer',
    });

    expect(updated!.status).toBe('review_passed');
    expect(updated!.archiveStatus).toBe('pending_transfer');
  });

  it('空更新应返回原记录', () => {
    const created = createPaperArchive('FA007');
    const updated = repo.update(created.id, {});

    expect(updated!.fundAccount).toBe('FA007');
    expect(updated!.status).toBe('pending_shipment');
  });

  describe('queryWithPagination', () => {
    beforeEach(() => {
      // 插入测试数据
      createPaperArchive('FA101', '北京营业部');
      createPaperArchive('FA102', '上海营业部');
      createPaperArchive('FA103', '北京营业部');

      repo.create({
        customerName: '王五',
        fundAccount: 'FA104',
        branchName: '广州营业部',
        contractType: '理财合同',
        openDate: '2024-03-01',
        contractVersionType: 'electronic',
        status: null,
        archiveStatus: 'archived',
      });
    });

    it('应返回所有记录（无筛选条件）', () => {
      const result = repo.queryWithPagination({ page: 1, pageSize: 20 });
      expect(result.total).toBe(4);
      expect(result.records).toHaveLength(4);
    });

    it('应支持分页', () => {
      const page1 = repo.queryWithPagination({ page: 1, pageSize: 2 });
      expect(page1.total).toBe(4);
      expect(page1.records).toHaveLength(2);

      const page2 = repo.queryWithPagination({ page: 2, pageSize: 2 });
      expect(page2.total).toBe(4);
      expect(page2.records).toHaveLength(2);
    });

    it('应支持客户姓名模糊匹配', () => {
      const result = repo.queryWithPagination({
        customerName: '王',
        page: 1,
        pageSize: 20,
      });
      expect(result.total).toBe(1);
      expect(result.records[0].customerName).toBe('王五');
    });

    it('应支持资金账号精确匹配', () => {
      const result = repo.queryWithPagination({
        fundAccount: 'FA102',
        page: 1,
        pageSize: 20,
      });
      expect(result.total).toBe(1);
      expect(result.records[0].fundAccount).toBe('FA102');
    });

    it('应支持营业部筛选', () => {
      const result = repo.queryWithPagination({
        branchName: '北京营业部',
        page: 1,
        pageSize: 20,
      });
      expect(result.total).toBe(2);
    });

    it('应支持合同版本类型筛选', () => {
      const result = repo.queryWithPagination({
        contractVersionType: 'electronic',
        page: 1,
        pageSize: 20,
      });
      expect(result.total).toBe(1);
      expect(result.records[0].contractVersionType).toBe('electronic');
    });

    it('应支持主流程状态筛选', () => {
      const result = repo.queryWithPagination({
        status: 'pending_shipment',
        page: 1,
        pageSize: 20,
      });
      expect(result.total).toBe(3);
    });

    it('应支持开户日期范围查询', () => {
      const result = repo.queryWithPagination({
        openDateStart: '2024-02-01',
        openDateEnd: '2024-12-31',
        page: 1,
        pageSize: 20,
      });
      expect(result.total).toBe(1);
      expect(result.records[0].fundAccount).toBe('FA104');
    });

    it('应支持多条件组合查询', () => {
      const result = repo.queryWithPagination({
        branchName: '北京营业部',
        status: 'pending_shipment',
        page: 1,
        pageSize: 20,
      });
      expect(result.total).toBe(2);
    });

    it('无匹配结果时应返回空列表', () => {
      const result = repo.queryWithPagination({
        fundAccount: 'NONEXISTENT',
        page: 1,
        pageSize: 20,
      });
      expect(result.total).toBe(0);
      expect(result.records).toHaveLength(0);
    });
  });
});

describe('UserRepository', () => {
  let db: Database.Database;
  let repo: UserRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new UserRepository(db);

    // 插入测试用户
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, branch_name)
      VALUES (?, ?, ?, ?, ?)
    `).run('u1', 'operator1', 'hash1', 'operator', null);

    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, branch_name)
      VALUES (?, ?, ?, ?, ?)
    `).run('u2', 'branch_bj', 'hash2', 'branch', '北京营业部');
  });

  afterEach(() => {
    db.close();
  });

  it('应通过用户名查询用户', () => {
    const user = repo.findByUsername('operator1');

    expect(user).not.toBeNull();
    expect(user!.id).toBe('u1');
    expect(user!.username).toBe('operator1');
    expect(user!.role).toBe('operator');
    expect(user!.branchName).toBeUndefined();
  });

  it('应通过用户名查询分支机构用户（含营业部）', () => {
    const user = repo.findByUsername('branch_bj');

    expect(user).not.toBeNull();
    expect(user!.role).toBe('branch');
    expect(user!.branchName).toBe('北京营业部');
  });

  it('查询不存在的用户名应返回 null', () => {
    const user = repo.findByUsername('nonexistent');
    expect(user).toBeNull();
  });

  it('应通过 ID 查询用户', () => {
    const user = repo.findById('u1');

    expect(user).not.toBeNull();
    expect(user!.username).toBe('operator1');
  });

  it('查询不存在的 ID 应返回 null', () => {
    const user = repo.findById('nonexistent');
    expect(user).toBeNull();
  });
});

describe('StatusChangeLogRepository', () => {
  let db: Database.Database;
  let logRepo: StatusChangeLogRepository;
  let archiveId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    logRepo = new StatusChangeLogRepository(db);

    // 先插入一条档案记录（外键约束需要）
    db.prepare(`
      INSERT INTO archive_records (id, customer_name, fund_account, branch_name, contract_type, open_date, contract_version_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('archive-1', '张三', 'FA001', '北京营业部', '开户合同', '2024-01-01', 'paper', 'pending_shipment');

    archiveId = 'archive-1';
  });

  afterEach(() => {
    db.close();
  });

  it('应创建状态变更日志', () => {
    const log = logRepo.create({
      archiveId,
      statusField: 'status',
      previousValue: 'pending_shipment',
      newValue: 'in_transit',
      action: 'confirm_shipment',
      operatorId: 'u1',
      operatorName: '操作员A',
    });

    expect(log.id).toBeDefined();
    expect(log.archiveId).toBe(archiveId);
    expect(log.statusField).toBe('status');
    expect(log.previousValue).toBe('pending_shipment');
    expect(log.newValue).toBe('in_transit');
    expect(log.action).toBe('confirm_shipment');
    expect(log.operatorId).toBe('u1');
    expect(log.operatorName).toBe('操作员A');
    expect(log.operatedAt).toBeDefined();
  });

  it('应支持 previousValue 为 null（创建操作）', () => {
    const log = logRepo.create({
      archiveId,
      statusField: 'status',
      previousValue: null,
      newValue: 'pending_shipment',
      action: 'create',
      operatorId: 'u1',
      operatorName: '操作员A',
    });

    expect(log.previousValue).toBeNull();
    expect(log.action).toBe('create');
  });

  it('应按档案 ID 查询所有日志', () => {
    logRepo.create({
      archiveId,
      statusField: 'status',
      previousValue: 'pending_shipment',
      newValue: 'in_transit',
      action: 'confirm_shipment',
      operatorId: 'u1',
      operatorName: '操作员A',
    });

    logRepo.create({
      archiveId,
      statusField: 'status',
      previousValue: 'in_transit',
      newValue: 'review_passed',
      action: 'review_pass',
      operatorId: 'u2',
      operatorName: '操作员B',
    });

    const logs = logRepo.findByArchiveId(archiveId);

    expect(logs).toHaveLength(2);
    const actions = logs.map(l => l.action);
    expect(actions).toContain('confirm_shipment');
    expect(actions).toContain('review_pass');
  });

  it('查询无日志的档案 ID 应返回空数组', () => {
    // 插入另一条档案记录
    db.prepare(`
      INSERT INTO archive_records (id, customer_name, fund_account, branch_name, contract_type, open_date, contract_version_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('archive-2', '李四', 'FA002', '上海营业部', '开户合同', '2024-01-02', 'paper', 'pending_shipment');

    const logs = logRepo.findByArchiveId('archive-2');
    expect(logs).toHaveLength(0);
  });
});
