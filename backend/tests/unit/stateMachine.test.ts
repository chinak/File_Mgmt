/**
 * 状态机核心逻辑单元测试
 * 覆盖主流程（8个状态值）、综合部归档两个状态转换表及角色校验
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StateMachineService,
  MAIN_STATUS_TRANSITIONS,
  ARCHIVE_STATUS_TRANSITIONS,
  ACTION_ROLE_MAP,
} from '../../src/services/StateMachineService';
import type { ArchiveRecord } from '../../shared/types';

let sm: StateMachineService;

/** 创建纸质版档案记录的辅助函数 */
function makePaperRecord(overrides: Partial<ArchiveRecord> = {}): ArchiveRecord {
  return {
    id: 'test-id',
    customerName: '测试客户',
    fundAccount: 'FA001',
    branchName: '上海营业部',
    contractType: '开户合同',
    openDate: '2024-01-01',
    contractVersionType: 'paper',
    status: 'pending_shipment',
    archiveStatus: 'archive_not_started',
    createdAt: '2024-01-01 00:00:00',
    updatedAt: '2024-01-01 00:00:00',
    ...overrides,
  };
}

beforeEach(() => {
  sm = new StateMachineService();
});

// ==================== 状态转换表结构验证 ====================

describe('状态转换表定义', () => {
  it('MAIN_STATUS_TRANSITIONS 应包含所有8个主流程状态', () => {
    expect(MAIN_STATUS_TRANSITIONS).toHaveProperty('pending_shipment');
    expect(MAIN_STATUS_TRANSITIONS).toHaveProperty('in_transit');
    expect(MAIN_STATUS_TRANSITIONS).toHaveProperty('hq_received');
    expect(MAIN_STATUS_TRANSITIONS).toHaveProperty('review_passed');
    expect(MAIN_STATUS_TRANSITIONS).toHaveProperty('review_rejected');
    expect(MAIN_STATUS_TRANSITIONS).toHaveProperty('pending_return');
    expect(MAIN_STATUS_TRANSITIONS).toHaveProperty('return_in_transit');
    expect(MAIN_STATUS_TRANSITIONS).toHaveProperty('branch_received');
  });

  it('ARCHIVE_STATUS_TRANSITIONS 应包含所有4个综合部归档状态', () => {
    expect(ARCHIVE_STATUS_TRANSITIONS).toHaveProperty('archive_not_started');
    expect(ARCHIVE_STATUS_TRANSITIONS).toHaveProperty('pending_transfer');
    expect(ARCHIVE_STATUS_TRANSITIONS).toHaveProperty('pending_archive');
    expect(ARCHIVE_STATUS_TRANSITIONS).toHaveProperty('archived');
  });

  it('ACTION_ROLE_MAP 应正确映射所有操作到角色', () => {
    expect(ACTION_ROLE_MAP['confirm_shipment']).toBe('branch');
    expect(ACTION_ROLE_MAP['confirm_received']).toBe('operator');
    expect(ACTION_ROLE_MAP['review_pass']).toBe('operator');
    expect(ACTION_ROLE_MAP['review_reject']).toBe('operator');
    expect(ACTION_ROLE_MAP['return_branch']).toBe('operator');
    expect(ACTION_ROLE_MAP['confirm_shipped_back']).toBe('operator');
    expect(ACTION_ROLE_MAP['confirm_return_received']).toBe('branch');
    expect(ACTION_ROLE_MAP['transfer_general']).toBe('operator');
    expect(ACTION_ROLE_MAP['confirm_archive']).toBe('general_affairs');
  });
});

// ==================== 主流程状态转换（8个状态完整路径） ====================

describe('主流程状态转换 (transition)', () => {
  it('pending_shipment + confirm_shipment → in_transit', () => {
    const record = makePaperRecord({ status: 'pending_shipment' });
    const result = sm.transition(record, 'confirm_shipment', 'branch');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('status');
    expect(result.previousValue).toBe('pending_shipment');
    expect(result.newValue).toBe('in_transit');
  });

  it('in_transit + confirm_received → hq_received', () => {
    const record = makePaperRecord({ status: 'in_transit' });
    const result = sm.transition(record, 'confirm_received', 'operator');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('status');
    expect(result.previousValue).toBe('in_transit');
    expect(result.newValue).toBe('hq_received');
  });

  it('hq_received + review_pass → review_passed', () => {
    const record = makePaperRecord({ status: 'hq_received', archiveStatus: 'archive_not_started' });
    const result = sm.transition(record, 'review_pass', 'operator');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('status');
    expect(result.previousValue).toBe('hq_received');
    expect(result.newValue).toBe('review_passed');
  });

  it('hq_received + review_reject → review_rejected', () => {
    const record = makePaperRecord({ status: 'hq_received', archiveStatus: 'archive_not_started' });
    const result = sm.transition(record, 'review_reject', 'operator');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('status');
    expect(result.previousValue).toBe('hq_received');
    expect(result.newValue).toBe('review_rejected');
  });

  it('review_passed + return_branch → pending_return', () => {
    const record = makePaperRecord({ status: 'review_passed', archiveStatus: 'pending_transfer' });
    const result = sm.transition(record, 'return_branch', 'operator');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('status');
    expect(result.previousValue).toBe('review_passed');
    expect(result.newValue).toBe('pending_return');
  });

  it('review_rejected + return_branch → pending_return', () => {
    const record = makePaperRecord({ status: 'review_rejected', archiveStatus: 'archive_not_started' });
    const result = sm.transition(record, 'return_branch', 'operator');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('status');
    expect(result.previousValue).toBe('review_rejected');
    expect(result.newValue).toBe('pending_return');
  });

  it('pending_return + confirm_shipped_back → return_in_transit', () => {
    const record = makePaperRecord({ status: 'pending_return' });
    const result = sm.transition(record, 'confirm_shipped_back', 'operator');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('status');
    expect(result.previousValue).toBe('pending_return');
    expect(result.newValue).toBe('return_in_transit');
  });

  it('return_in_transit + confirm_return_received → branch_received', () => {
    const record = makePaperRecord({ status: 'return_in_transit', archiveStatus: 'pending_transfer' });
    const result = sm.transition(record, 'confirm_return_received', 'branch');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('status');
    expect(result.previousValue).toBe('return_in_transit');
    expect(result.newValue).toBe('branch_received');
  });

  it('pending_shipment 不允许 review_pass（跳过中间状态）', () => {
    const record = makePaperRecord({ status: 'pending_shipment' });
    const result = sm.transition(record, 'review_pass', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('状态流转不合法');
  });

  it('主流程状态为 null 时不允许任何主流程转换', () => {
    const record = makePaperRecord({ status: null });
    const result = sm.transition(record, 'confirm_shipment', 'branch');

    expect(result.success).toBe(false);
    expect(result.error).toBe('状态流转不合法');
  });

  it('主流程状态为 completed 时不允许任何转换', () => {
    const record = makePaperRecord({ status: 'completed', archiveStatus: 'archived' });
    const result = sm.transition(record, 'confirm_shipment', 'branch');

    expect(result.success).toBe(false);
    expect(result.error).toBe('该记录已完全完结，不可修改');
  });
});

// ==================== review_pass 联动 archive_status ====================

describe('review_pass 联动 archive_status', () => {
  it('review_pass 应产生 sideEffect：archive_status 从 archive_not_started → pending_transfer', () => {
    const record = makePaperRecord({ status: 'hq_received', archiveStatus: 'archive_not_started' });
    const result = sm.transition(record, 'review_pass', 'operator');

    expect(result.success).toBe(true);
    expect(result.newValue).toBe('review_passed');
    expect(result.sideEffects).toBeDefined();
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects![0]).toEqual({
      statusField: 'archive_status',
      previousValue: 'archive_not_started',
      newValue: 'pending_transfer',
    });
  });

  it('review_reject 不应产生 archive_status 的 sideEffect', () => {
    const record = makePaperRecord({ status: 'hq_received', archiveStatus: 'archive_not_started' });
    const result = sm.transition(record, 'review_reject', 'operator');

    expect(result.success).toBe(true);
    expect(result.newValue).toBe('review_rejected');
    expect(result.sideEffects).toBeUndefined();
  });
});

// ==================== confirm_return_received 自动判断逻辑 ====================

describe('confirm_return_received 自动判断逻辑', () => {
  it('archive_status = archive_not_started → sideEffect: status 回退到 pending_shipment', () => {
    const record = makePaperRecord({ status: 'return_in_transit', archiveStatus: 'archive_not_started' });
    const result = sm.transition(record, 'confirm_return_received', 'branch');

    expect(result.success).toBe(true);
    expect(result.newValue).toBe('branch_received');
    expect(result.sideEffects).toBeDefined();
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects![0]).toEqual({
      statusField: 'status',
      previousValue: 'branch_received',
      newValue: 'pending_shipment',
    });
  });

  it('archive_status = archived → sideEffect: status 完结为 completed', () => {
    const record = makePaperRecord({ status: 'return_in_transit', archiveStatus: 'archived' });
    const result = sm.transition(record, 'confirm_return_received', 'branch');

    expect(result.success).toBe(true);
    expect(result.newValue).toBe('branch_received');
    expect(result.sideEffects).toBeDefined();
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects![0]).toEqual({
      statusField: 'status',
      previousValue: 'branch_received',
      newValue: 'completed',
    });
  });

  it('archive_status = pending_transfer → status 保持 branch_received，无 sideEffect', () => {
    const record = makePaperRecord({ status: 'return_in_transit', archiveStatus: 'pending_transfer' });
    const result = sm.transition(record, 'confirm_return_received', 'branch');

    expect(result.success).toBe(true);
    expect(result.newValue).toBe('branch_received');
    expect(result.sideEffects).toBeUndefined();
  });

  it('archive_status = pending_archive → status 保持 branch_received，无 sideEffect', () => {
    const record = makePaperRecord({ status: 'return_in_transit', archiveStatus: 'pending_archive' });
    const result = sm.transition(record, 'confirm_return_received', 'branch');

    expect(result.success).toBe(true);
    expect(result.newValue).toBe('branch_received');
    expect(result.sideEffects).toBeUndefined();
  });
});

// ==================== 综合部归档状态转换 ====================

describe('综合部归档状态转换 (transition)', () => {
  it('待转交 + transfer_general → 待综合部入库', () => {
    const record = makePaperRecord({
      status: 'review_passed',
      archiveStatus: 'pending_transfer',
    });
    const result = sm.transition(record, 'transfer_general', 'operator');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('archive_status');
    expect(result.previousValue).toBe('pending_transfer');
    expect(result.newValue).toBe('pending_archive');
  });

  it('待综合部入库 + confirm_archive → 已归档-完结', () => {
    const record = makePaperRecord({
      status: 'review_passed',
      archiveStatus: 'pending_archive',
    });
    const result = sm.transition(record, 'confirm_archive', 'general_affairs');

    expect(result.success).toBe(true);
    expect(result.statusField).toBe('archive_status');
    expect(result.previousValue).toBe('pending_archive');
    expect(result.newValue).toBe('archived');
  });

  it('待综合部入库不允许 transfer_general（已完成转交）', () => {
    const record = makePaperRecord({
      status: 'review_passed',
      archiveStatus: 'pending_archive',
    });
    const result = sm.transition(record, 'transfer_general', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('该记录已完成转交综合部');
  });

  it('已归档-完结不允许 transfer_general', () => {
    const record = makePaperRecord({
      status: 'review_passed',
      archiveStatus: 'archived',
    });
    const result = sm.transition(record, 'transfer_general', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('该记录已完成转交综合部');
  });

  it('已归档-完结不允许 confirm_archive', () => {
    const record = makePaperRecord({
      status: 'review_passed',
      archiveStatus: 'archived',
    });
    const result = sm.transition(record, 'confirm_archive', 'general_affairs');

    expect(result.success).toBe(false);
    expect(result.error).toBe('状态流转不合法');
  });

  it('待转交不允许 confirm_archive', () => {
    const record = makePaperRecord({
      status: 'review_passed',
      archiveStatus: 'pending_transfer',
    });
    const result = sm.transition(record, 'confirm_archive', 'general_affairs');

    expect(result.success).toBe(false);
    expect(result.error).toBe('状态流转不合法');
  });
});

// ==================== 角色校验 ====================

describe('角色校验 (transition)', () => {
  it('非 branch 角色不能执行 confirm_shipment', () => {
    const record = makePaperRecord({ status: 'pending_shipment' });
    const result = sm.transition(record, 'confirm_shipment', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('权限不足');
  });

  it('非 operator 角色不能执行 confirm_received', () => {
    const record = makePaperRecord({ status: 'in_transit' });
    const result = sm.transition(record, 'confirm_received', 'branch');

    expect(result.success).toBe(false);
    expect(result.error).toBe('权限不足');
  });

  it('非 operator 角色不能执行 review_pass', () => {
    const record = makePaperRecord({ status: 'hq_received' });
    const result = sm.transition(record, 'review_pass', 'branch');

    expect(result.success).toBe(false);
    expect(result.error).toBe('权限不足');
  });

  it('非 operator 角色不能执行 review_reject', () => {
    const record = makePaperRecord({ status: 'hq_received' });
    const result = sm.transition(record, 'review_reject', 'branch');

    expect(result.success).toBe(false);
    expect(result.error).toBe('权限不足');
  });

  it('非 operator 角色不能执行 return_branch', () => {
    const record = makePaperRecord({ status: 'review_passed', archiveStatus: 'pending_transfer' });
    const result = sm.transition(record, 'return_branch', 'general_affairs');

    expect(result.success).toBe(false);
    expect(result.error).toBe('权限不足');
  });

  it('非 operator 角色不能执行 confirm_shipped_back', () => {
    const record = makePaperRecord({ status: 'pending_return' });
    const result = sm.transition(record, 'confirm_shipped_back', 'branch');

    expect(result.success).toBe(false);
    expect(result.error).toBe('权限不足');
  });

  it('非 operator 角色不能执行 transfer_general', () => {
    const record = makePaperRecord({
      status: 'review_passed',
      archiveStatus: 'pending_transfer',
    });
    const result = sm.transition(record, 'transfer_general', 'branch');

    expect(result.success).toBe(false);
    expect(result.error).toBe('权限不足');
  });

  it('非 general_affairs 角色不能执行 confirm_archive', () => {
    const record = makePaperRecord({
      status: 'review_passed',
      archiveStatus: 'pending_archive',
    });
    const result = sm.transition(record, 'confirm_archive', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('权限不足');
  });
});

// ==================== 电子版合同保护 ====================

describe('电子版合同保护 (transition)', () => {
  /** 创建电子版档案记录的辅助函数 */
  function makeElectronicRecord(): ArchiveRecord {
    return {
      id: 'elec-id',
      customerName: '电子版客户',
      fundAccount: 'FA-ELEC-001',
      branchName: '北京营业部',
      contractType: '开户合同',
      openDate: '2024-01-01',
      contractVersionType: 'electronic',
      status: null,
      archiveStatus: 'archived',
      createdAt: '2024-01-01 00:00:00',
      updatedAt: '2024-01-01 00:00:00',
    };
  }

  it('电子版合同拒绝 confirm_shipment 操作', () => {
    const record = makeElectronicRecord();
    const result = sm.transition(record, 'confirm_shipment', 'branch');

    expect(result.success).toBe(false);
    expect(result.error).toBe('电子版合同无需执行此操作');
  });

  it('电子版合同拒绝 review_pass 操作', () => {
    const record = makeElectronicRecord();
    const result = sm.transition(record, 'review_pass', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('电子版合同无需执行此操作');
  });

  it('电子版合同拒绝 return_branch 操作', () => {
    const record = makeElectronicRecord();
    const result = sm.transition(record, 'return_branch', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('电子版合同无需执行此操作');
  });

  it('电子版合同拒绝 transfer_general 操作', () => {
    const record = makeElectronicRecord();
    const result = sm.transition(record, 'transfer_general', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('电子版合同无需执行此操作');
  });

  it('电子版合同拒绝 confirm_archive 操作', () => {
    const record = makeElectronicRecord();
    const result = sm.transition(record, 'confirm_archive', 'general_affairs');

    expect(result.success).toBe(false);
    expect(result.error).toBe('电子版合同无需执行此操作');
  });
});

// ==================== 完全完结保护 ====================

describe('完全完结保护 (transition)', () => {
  it('status=completed 的记录拒绝 return_branch 操作', () => {
    const record = makePaperRecord({
      status: 'completed',
      archiveStatus: 'archived',
    });
    const result = sm.transition(record, 'return_branch', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('该记录已完全完结，不可修改');
  });

  it('status=completed 的记录拒绝 transfer_general 操作', () => {
    const record = makePaperRecord({
      status: 'completed',
      archiveStatus: 'archived',
    });
    const result = sm.transition(record, 'transfer_general', 'operator');

    expect(result.success).toBe(false);
    expect(result.error).toBe('该记录已完全完结，不可修改');
  });

  it('status=completed 的记录拒绝 confirm_archive 操作', () => {
    const record = makePaperRecord({
      status: 'completed',
      archiveStatus: 'archived',
    });
    const result = sm.transition(record, 'confirm_archive', 'general_affairs');

    expect(result.success).toBe(false);
    expect(result.error).toBe('该记录已完全完结，不可修改');
  });

  it('status=completed 的记录拒绝 confirm_shipment 操作', () => {
    const record = makePaperRecord({
      status: 'completed',
      archiveStatus: 'archived',
    });
    const result = sm.transition(record, 'confirm_shipment', 'branch');

    expect(result.success).toBe(false);
    expect(result.error).toBe('该记录已完全完结，不可修改');
  });

  it('未完全完结的记录允许正常操作', () => {
    const record = makePaperRecord({
      status: 'review_passed',
      archiveStatus: 'pending_transfer',
    });
    const result = sm.transition(record, 'return_branch', 'operator');

    expect(result.success).toBe(true);
    expect(result.newValue).toBe('pending_return');
  });
});

// ==================== isFullyCompleted ====================

describe('isFullyCompleted', () => {
  it('status === completed → 完全完结', () => {
    const record = makePaperRecord({ status: 'completed', archiveStatus: 'archived' });
    expect(sm.isFullyCompleted(record)).toBe(true);
  });

  it('status === pending_shipment → 未完全完结', () => {
    const record = makePaperRecord({ status: 'pending_shipment', archiveStatus: 'archive_not_started' });
    expect(sm.isFullyCompleted(record)).toBe(false);
  });

  it('status === branch_received 且 archiveStatus === archived → 未完全完结（尚未自动设为 completed）', () => {
    const record = makePaperRecord({ status: 'branch_received', archiveStatus: 'archived' });
    expect(sm.isFullyCompleted(record)).toBe(false);
  });

  it('status === review_passed 且 archiveStatus === pending_transfer → 未完全完结', () => {
    const record = makePaperRecord({ status: 'review_passed', archiveStatus: 'pending_transfer' });
    expect(sm.isFullyCompleted(record)).toBe(false);
  });

  it('status === null（电子版）→ 未完全完结', () => {
    const record = makePaperRecord({
      contractVersionType: 'electronic',
      status: null,
      archiveStatus: 'archived',
    });
    expect(sm.isFullyCompleted(record)).toBe(false);
  });
});
