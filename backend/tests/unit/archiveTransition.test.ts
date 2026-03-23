/**
 * 档案状态流转服务单元测试
 * 验证 ArchiveTransitionService 整合状态机校验、档案更新、日志记录的完整流程
 *
 * 测试覆盖：
 * - 成功流转 + 日志记录（含新增的 confirm_received、review_reject、confirm_shipped_back）
 * - review_pass 联动：status 变更 + archive_status 从 archive_not_started → pending_transfer，产生两条日志
 * - confirm_return_received 自动判断：根据 archive_status 自动回退或完结
 * - 审核不通过循环回退
 * - 完整流转路径日志验证（8步流转）
 * - 失败场景
 * - 批量状态流转
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase } from '../../src/database';
import { ArchiveRepository } from '../../src/models/ArchiveRepository';
import { StatusChangeLogRepository } from '../../src/models/StatusChangeLogRepository';
import { StateMachineService } from '../../src/services/StateMachineService';
import { ArchiveTransitionService } from '../../src/services/ArchiveTransitionService';

let db: Database.Database;
let archiveRepo: ArchiveRepository;
let logRepo: StatusChangeLogRepository;
let stateMachine: StateMachineService;
let service: ArchiveTransitionService;

/** 插入纸质版档案记录的辅助函数 */
function createPaperArchive(fundAccount: string) {
  return archiveRepo.create({
    customerName: '测试客户',
    fundAccount,
    branchName: '上海营业部',
    contractType: '开户合同',
    openDate: '2024-01-01',
    contractVersionType: 'paper',
    status: 'pending_shipment',
    archiveStatus: 'archive_not_started',
  });
}

/** 插入电子版档案记录的辅助函数 */
function createElectronicArchive(fundAccount: string) {
  return archiveRepo.create({
    customerName: '电子版客户',
    fundAccount,
    branchName: '北京营业部',
    contractType: '开户合同',
    openDate: '2024-01-01',
    contractVersionType: 'electronic',
    status: null,
    archiveStatus: 'archived',
  });
}

beforeEach(() => {
  db = createDatabase(':memory:');
  archiveRepo = new ArchiveRepository(db);
  logRepo = new StatusChangeLogRepository(db);
  stateMachine = new StateMachineService();
  service = new ArchiveTransitionService(stateMachine, archiveRepo, logRepo);
});

afterEach(() => {
  db.close();
});


// ==================== 成功流转 + 日志记录 ====================

describe('成功的状态流转与日志记录', () => {
  it('confirm_shipment：pending_shipment → in_transit 并写入日志', () => {
    const record = createPaperArchive('FA001');
    const result = service.executeTransition(
      record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员',
    );

    expect(result.success).toBe(true);
    expect(result.record.status).toBe('in_transit');

    const logs = logRepo.findByArchiveId(record.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].statusField).toBe('status');
    expect(logs[0].previousValue).toBe('pending_shipment');
    expect(logs[0].newValue).toBe('in_transit');
    expect(logs[0].action).toBe('confirm_shipment');
    expect(logs[0].operatorId).toBe('u1');
    expect(logs[0].operatorName).toBe('分支操作员');
    expect(logs[0].operatedAt).toBeDefined();
  });

  it('confirm_received：in_transit → hq_received 并写入日志', () => {
    const record = createPaperArchive('FA-CR');
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');

    const result = service.executeTransition(
      record.id, 'confirm_received', 'operator', 'u2', '运营人员A',
    );

    expect(result.success).toBe(true);
    expect(result.record.status).toBe('hq_received');

    const logs = logRepo.findByArchiveId(record.id);
    const crLog = logs.find(l => l.action === 'confirm_received')!;
    expect(crLog.statusField).toBe('status');
    expect(crLog.previousValue).toBe('in_transit');
    expect(crLog.newValue).toBe('hq_received');
  });

  it('review_pass：hq_received → review_passed + archive_status 联动，产生两条日志', () => {
    const record = createPaperArchive('FA002');
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');

    const result = service.executeTransition(
      record.id, 'review_pass', 'operator', 'u2', '运营人员A',
    );

    expect(result.success).toBe(true);
    expect(result.record.status).toBe('review_passed');
    // 联动：archive_status 从 archive_not_started → pending_transfer
    expect(result.record.archiveStatus).toBe('pending_transfer');

    const logs = logRepo.findByArchiveId(record.id);
    // confirm_shipment(1) + confirm_received(1) + review_pass(1 status + 1 archive_status) = 4
    const reviewLogs = logs.filter(l => l.action === 'review_pass');
    expect(reviewLogs).toHaveLength(2);

    const statusLog = reviewLogs.find(l => l.statusField === 'status')!;
    expect(statusLog.previousValue).toBe('hq_received');
    expect(statusLog.newValue).toBe('review_passed');

    const archiveLog = reviewLogs.find(l => l.statusField === 'archive_status')!;
    expect(archiveLog.previousValue).toBe('archive_not_started');
    expect(archiveLog.newValue).toBe('pending_transfer');
  });

  it('review_reject：hq_received → review_rejected 并写入日志', () => {
    const record = createPaperArchive('FA-RJ');
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');

    const result = service.executeTransition(
      record.id, 'review_reject', 'operator', 'u2', '运营人员A',
    );

    expect(result.success).toBe(true);
    expect(result.record.status).toBe('review_rejected');
    // archive_status 保持 archive_not_started 不变
    expect(result.record.archiveStatus).toBe('archive_not_started');

    const logs = logRepo.findByArchiveId(record.id);
    const rejectLog = logs.find(l => l.action === 'review_reject')!;
    expect(rejectLog.statusField).toBe('status');
    expect(rejectLog.previousValue).toBe('hq_received');
    expect(rejectLog.newValue).toBe('review_rejected');
  });

  it('return_branch：review_passed → pending_return 并写入日志', () => {
    const record = createPaperArchive('FA003');
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'review_pass', 'operator', 'u2', '运营人员A');

    const result = service.executeTransition(
      record.id, 'return_branch', 'operator', 'u2', '运营人员A',
    );

    expect(result.success).toBe(true);
    expect(result.record.status).toBe('pending_return');
    // archive_status 不受影响
    expect(result.record.archiveStatus).toBe('pending_transfer');

    const logs = logRepo.findByArchiveId(record.id);
    const returnLog = logs.find(l => l.action === 'return_branch')!;
    expect(returnLog.statusField).toBe('status');
    expect(returnLog.previousValue).toBe('review_passed');
    expect(returnLog.newValue).toBe('pending_return');
  });

  it('confirm_shipped_back：pending_return → return_in_transit 并写入日志', () => {
    const record = createPaperArchive('FA-CSB');
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'review_pass', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'return_branch', 'operator', 'u2', '运营人员A');

    const result = service.executeTransition(
      record.id, 'confirm_shipped_back', 'operator', 'u2', '运营人员A',
    );

    expect(result.success).toBe(true);
    expect(result.record.status).toBe('return_in_transit');

    const logs = logRepo.findByArchiveId(record.id);
    const csbLog = logs.find(l => l.action === 'confirm_shipped_back')!;
    expect(csbLog.statusField).toBe('status');
    expect(csbLog.previousValue).toBe('pending_return');
    expect(csbLog.newValue).toBe('return_in_transit');
  });

  it('transfer_general：更新综合部归档状态并写入日志', () => {
    const record = createPaperArchive('FA004');
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'review_pass', 'operator', 'u2', '运营人员A');

    const result = service.executeTransition(
      record.id, 'transfer_general', 'operator', 'u2', '运营人员A',
    );

    expect(result.success).toBe(true);
    expect(result.record.archiveStatus).toBe('pending_archive');

    const logs = logRepo.findByArchiveId(record.id);
    const transferLog = logs.find(l => l.action === 'transfer_general')!;
    expect(transferLog.statusField).toBe('archive_status');
    expect(transferLog.previousValue).toBe('pending_transfer');
    expect(transferLog.newValue).toBe('pending_archive');
  });

  it('confirm_archive：更新综合部归档状态并写入日志', () => {
    const record = createPaperArchive('FA005');
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'review_pass', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'transfer_general', 'operator', 'u2', '运营人员A');

    const result = service.executeTransition(
      record.id, 'confirm_archive', 'general_affairs', 'u3', '综合部人员',
    );

    expect(result.success).toBe(true);
    expect(result.record.archiveStatus).toBe('archived');

    const logs = logRepo.findByArchiveId(record.id);
    const archiveLog = logs.find(l => l.action === 'confirm_archive')!;
    expect(archiveLog.statusField).toBe('archive_status');
    expect(archiveLog.previousValue).toBe('pending_archive');
    expect(archiveLog.newValue).toBe('archived');
    expect(archiveLog.operatorId).toBe('u3');
    expect(archiveLog.operatorName).toBe('综合部人员');
  });
});


// ==================== 完整流转路径日志验证 ====================

describe('完整流转路径日志验证', () => {
  it('纸质版合同完整流转（审核通过路径）应产生正确数量的日志', () => {
    const record = createPaperArchive('FA-FULL');

    // 8步完整流转路径：
    // 1. confirm_shipment: pending_shipment → in_transit (1条日志)
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    // 2. confirm_received: in_transit → hq_received (1条日志)
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');
    // 3. review_pass: hq_received → review_passed + archive_status 联动 (2条日志)
    service.executeTransition(record.id, 'review_pass', 'operator', 'u2', '运营人员A');
    // 4. return_branch: review_passed → pending_return (1条日志)
    service.executeTransition(record.id, 'return_branch', 'operator', 'u2', '运营人员A');
    // 5. confirm_shipped_back: pending_return → return_in_transit (1条日志)
    service.executeTransition(record.id, 'confirm_shipped_back', 'operator', 'u2', '运营人员A');
    // 6. confirm_return_received: return_in_transit → branch_received (1条日志, 此时 archive_status=pending_transfer，保持 branch_received)
    service.executeTransition(record.id, 'confirm_return_received', 'branch', 'u1', '分支操作员');
    // 7. transfer_general: pending_transfer → pending_archive (1条日志)
    service.executeTransition(record.id, 'transfer_general', 'operator', 'u2', '运营人员A');
    // 8. confirm_archive: pending_archive → archived (1条日志)
    service.executeTransition(record.id, 'confirm_archive', 'general_affairs', 'u3', '综合部人员');

    // 验证最终状态
    const finalRecord = archiveRepo.findById(record.id)!;
    expect(finalRecord.status).toBe('branch_received');
    expect(finalRecord.archiveStatus).toBe('archived');

    const logs = logRepo.findByArchiveId(record.id);
    // 1 + 1 + 2 + 1 + 1 + 1 + 1 + 1 = 9 条日志
    expect(logs).toHaveLength(9);

    // 验证每条日志的关键字段都不为空
    for (const log of logs) {
      expect(log.id).toBeDefined();
      expect(log.archiveId).toBe(record.id);
      expect(log.statusField).toBeTruthy();
      expect(log.newValue).toBeTruthy();
      expect(log.action).toBeTruthy();
      expect(log.operatorId).toBeTruthy();
      expect(log.operatorName).toBeTruthy();
      expect(log.operatedAt).toBeDefined();
    }
  });
});

// ==================== 审核不通过循环回退 ====================

describe('审核不通过循环回退', () => {
  it('审核不通过 → 回寄 → 分支确认收到 → 自动回退 pending_shipment', () => {
    const record = createPaperArchive('FA-REJECT-LOOP');

    // 第一轮：寄送 → 收到 → 审核不通过 → 回寄 → 确认已寄出 → 分支确认收到
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'review_reject', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'return_branch', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_shipped_back', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_return_received', 'branch', 'u1', '分支操作员');

    // 验证自动回退到 pending_shipment（因 archive_status = archive_not_started）
    const afterFirstLoop = archiveRepo.findById(record.id)!;
    expect(afterFirstLoop.status).toBe('pending_shipment');
    expect(afterFirstLoop.archiveStatus).toBe('archive_not_started');

    // 第二轮：可以重新寄送
    const reshipResult = service.executeTransition(
      record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员',
    );
    expect(reshipResult.success).toBe(true);
    expect(reshipResult.record.status).toBe('in_transit');
  });

  it('confirm_return_received 自动完结（archive_status=archived）', () => {
    const record = createPaperArchive('FA-COMPLETE');

    // 走审核通过路径
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'review_pass', 'operator', 'u2', '运营人员A');
    // 先完成归档流程
    service.executeTransition(record.id, 'transfer_general', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_archive', 'general_affairs', 'u3', '综合部人员');
    // 继续主流程回寄
    service.executeTransition(record.id, 'return_branch', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_shipped_back', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_return_received', 'branch', 'u1', '分支操作员');

    // 验证自动完结（因 archive_status = archived）
    const finalRecord = archiveRepo.findById(record.id)!;
    expect(finalRecord.status).toBe('completed');
    expect(finalRecord.archiveStatus).toBe('archived');
  });

  it('confirm_return_received 保持 branch_received（archive_status 为中间状态）', () => {
    const record = createPaperArchive('FA-WAIT');

    // 走审核通过路径但不完成归档
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'review_pass', 'operator', 'u2', '运营人员A');
    // archive_status 现在是 pending_transfer，不完成归档
    service.executeTransition(record.id, 'return_branch', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_shipped_back', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_return_received', 'branch', 'u1', '分支操作员');

    // archive_status = pending_transfer，保持 branch_received
    const finalRecord = archiveRepo.findById(record.id)!;
    expect(finalRecord.status).toBe('branch_received');
    expect(finalRecord.archiveStatus).toBe('pending_transfer');
  });
});


// ==================== 失败场景：不写入日志 ====================

describe('失败的状态流转不写入日志', () => {
  it('档案记录不存在时返回失败', () => {
    const result = service.executeTransition(
      'nonexistent-id', 'confirm_shipment', 'branch', 'u1', '分支操作员',
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('档案记录不存在');
  });

  it('电子版合同拒绝操作且不写入日志', () => {
    const record = createElectronicArchive('FA-ELEC');
    const result = service.executeTransition(
      record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员',
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('电子版合同无需执行此操作');

    const logs = logRepo.findByArchiveId(record.id);
    expect(logs).toHaveLength(0);
  });

  it('角色不匹配时拒绝操作且不写入日志', () => {
    const record = createPaperArchive('FA-ROLE');
    const result = service.executeTransition(
      record.id, 'confirm_shipment', 'operator', 'u1', '运营人员',
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('权限不足');

    const logs = logRepo.findByArchiveId(record.id);
    expect(logs).toHaveLength(0);
  });

  it('非法状态跳转时拒绝操作且不写入日志', () => {
    const record = createPaperArchive('FA-SKIP');
    // 尝试跳过 confirm_shipment 直接 review_pass
    const result = service.executeTransition(
      record.id, 'review_pass', 'operator', 'u1', '运营人员',
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('状态流转不合法');

    const logs = logRepo.findByArchiveId(record.id);
    expect(logs).toHaveLength(0);
  });

  it('已完结记录拒绝操作且不写入日志', () => {
    const record = createPaperArchive('FA-COMPLETED');

    // 走完整流程到 completed
    service.executeTransition(record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
    service.executeTransition(record.id, 'confirm_received', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'review_pass', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'transfer_general', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_archive', 'general_affairs', 'u3', '综合部人员');
    service.executeTransition(record.id, 'return_branch', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_shipped_back', 'operator', 'u2', '运营人员A');
    service.executeTransition(record.id, 'confirm_return_received', 'branch', 'u1', '分支操作员');

    // 确认已完结
    const completedRecord = archiveRepo.findById(record.id)!;
    expect(completedRecord.status).toBe('completed');

    const logsBefore = logRepo.findByArchiveId(record.id);
    const logCountBefore = logsBefore.length;

    // 尝试对已完结记录执行操作
    const result = service.executeTransition(
      record.id, 'confirm_shipment', 'branch', 'u1', '分支操作员',
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('该记录已完全完结，不可修改');

    // 不应产生新日志
    const logsAfter = logRepo.findByArchiveId(record.id);
    expect(logsAfter).toHaveLength(logCountBefore);
  });
});

// ==================== 批量状态流转 ====================

describe('批量状态流转 executeBatchTransition', () => {
  it('批量确认寄出：全部成功', () => {
    const r1 = createPaperArchive('BATCH-001');
    const r2 = createPaperArchive('BATCH-002');
    const r3 = createPaperArchive('BATCH-003');

    const result = service.executeBatchTransition(
      [r1.id, r2.id, r3.id],
      'confirm_shipment',
      'branch',
      'u1',
      '分支操作员',
    );

    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
    expect(result.results).toHaveLength(3);
    result.results.forEach(r => expect(r.success).toBe(true));

    for (const id of [r1.id, r2.id, r3.id]) {
      const record = archiveRepo.findById(id);
      expect(record!.status).toBe('in_transit');
    }
  });

  it('批量确认入库：全部成功', () => {
    const records = ['BATCH-GA-001', 'BATCH-GA-002'].map(fa => {
      const r = createPaperArchive(fa);
      service.executeTransition(r.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');
      service.executeTransition(r.id, 'confirm_received', 'operator', 'u2', '运营人员A');
      service.executeTransition(r.id, 'review_pass', 'operator', 'u2', '运营人员A');
      service.executeTransition(r.id, 'transfer_general', 'operator', 'u2', '运营人员A');
      return r;
    });

    const result = service.executeBatchTransition(
      records.map(r => r.id),
      'confirm_archive',
      'general_affairs',
      'u3',
      '综合部人员',
    );

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);

    for (const r of records) {
      const updated = archiveRepo.findById(r.id);
      expect(updated!.archiveStatus).toBe('archived');
    }
  });

  it('批量操作部分成功部分失败', () => {
    const r1 = createPaperArchive('BATCH-MIX-001');
    const r2 = createPaperArchive('BATCH-MIX-002');
    service.executeTransition(r2.id, 'confirm_shipment', 'branch', 'u1', '分支操作员');

    const result = service.executeBatchTransition(
      [r1.id, r2.id],
      'confirm_shipment',
      'branch',
      'u1',
      '分支操作员',
    );

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);

    const successResult = result.results.find(r => r.archiveId === r1.id)!;
    expect(successResult.success).toBe(true);

    const failResult = result.results.find(r => r.archiveId === r2.id)!;
    expect(failResult.success).toBe(false);
    expect(failResult.message).toBeDefined();
  });

  it('批量操作包含不存在的记录', () => {
    const r1 = createPaperArchive('BATCH-NF-001');

    const result = service.executeBatchTransition(
      [r1.id, 'nonexistent-id'],
      'confirm_shipment',
      'branch',
      'u1',
      '分支操作员',
    );

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);

    const failResult = result.results.find(r => r.archiveId === 'nonexistent-id')!;
    expect(failResult.success).toBe(false);
    expect(failResult.message).toBe('档案记录不存在');
  });

  it('批量操作角色不匹配全部失败', () => {
    const r1 = createPaperArchive('BATCH-ROLE-001');
    const r2 = createPaperArchive('BATCH-ROLE-002');

    const result = service.executeBatchTransition(
      [r1.id, r2.id],
      'confirm_shipment',
      'operator',
      'u1',
      '运营人员',
    );

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(2);
    result.results.forEach(r => {
      expect(r.success).toBe(false);
      expect(r.message).toBe('权限不足');
    });
  });

  it('批量操作电子版合同全部拒绝', () => {
    const r1 = createElectronicArchive('BATCH-ELEC-001');
    const r2 = createElectronicArchive('BATCH-ELEC-002');

    const result = service.executeBatchTransition(
      [r1.id, r2.id],
      'confirm_shipment',
      'branch',
      'u1',
      '分支操作员',
    );

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(2);
    result.results.forEach(r => {
      expect(r.success).toBe(false);
      expect(r.message).toBe('电子版合同无需执行此操作');
    });
  });

  it('批量操作每条成功记录都写入日志', () => {
    const r1 = createPaperArchive('BATCH-LOG-001');
    const r2 = createPaperArchive('BATCH-LOG-002');

    service.executeBatchTransition(
      [r1.id, r2.id],
      'confirm_shipment',
      'branch',
      'u1',
      '分支操作员',
    );

    for (const id of [r1.id, r2.id]) {
      const logs = logRepo.findByArchiveId(id);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('confirm_shipment');
      expect(logs[0].statusField).toBe('status');
      expect(logs[0].previousValue).toBe('pending_shipment');
      expect(logs[0].newValue).toBe('in_transit');
    }
  });
});
