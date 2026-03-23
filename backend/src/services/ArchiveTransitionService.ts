/**
 * 档案状态流转服务
 * 整合状态机校验、档案记录更新、状态变更日志记录三个步骤
 * 每次成功的状态变更后，自动写入 status_change_logs 表
 *
 * 特殊处理：
 * - review_pass 联动：status 变更 + archive_status 变更，产生两条日志
 * - confirm_return_received 自动判断：branch_received 后可能产生额外的 status 变更日志
 */

import type {
  ArchiveRecord,
  TransitionAction,
  UserRole,
  TransitionResponse,
  BatchTransitionResponse,
} from '../../shared/types';
import { StateMachineService } from './StateMachineService';
import type { TransitionResult } from './StateMachineService';
import { ArchiveRepository } from '../models/ArchiveRepository';
import type { UpdateArchiveInput } from '../models/ArchiveRepository';
import { StatusChangeLogRepository } from '../models/StatusChangeLogRepository';

export class ArchiveTransitionService {
  private stateMachine: StateMachineService;
  private archiveRepo: ArchiveRepository;
  private logRepo: StatusChangeLogRepository;

  constructor(
    stateMachine: StateMachineService,
    archiveRepo: ArchiveRepository,
    logRepo: StatusChangeLogRepository,
  ) {
    this.stateMachine = stateMachine;
    this.archiveRepo = archiveRepo;
    this.logRepo = logRepo;
  }

  /**
   * 执行档案状态流转
   * 1. 查询档案记录
   * 2. 调用状态机校验转换合法性
   * 3. 更新档案记录对应的状态字段（含联动副作用）
   * 4. 写入状态变更日志（主变更 + 副作用变更）
   */
  executeTransition(
    archiveId: string,
    action: TransitionAction,
    userRole: UserRole,
    operatorId: string,
    operatorName: string,
  ): TransitionResponse {
    // 查询档案记录
    const record = this.archiveRepo.findById(archiveId);
    if (!record) {
      return {
        success: false,
        record: null as unknown as ArchiveRecord,
        message: '档案记录不存在',
      };
    }

    // 调用状态机校验
    const result: TransitionResult = this.stateMachine.transition(record, action, userRole);
    if (!result.success) {
      return {
        success: false,
        record,
        message: result.error,
      };
    }

    // 构建更新参数，根据 statusField 更新对应字段
    const updateInput: UpdateArchiveInput = {};
    if (result.statusField === 'status') {
      updateInput.status = result.newValue as ArchiveRecord['status'];
    } else if (result.statusField === 'archive_status') {
      updateInput.archiveStatus = result.newValue as ArchiveRecord['archiveStatus'];
    }

    // 处理联动副作用（review_pass 联动 archive_status，confirm_return_received 自动判断）
    if (result.sideEffects) {
      for (const effect of result.sideEffects) {
        if (effect.statusField === 'status') {
          updateInput.status = effect.newValue as ArchiveRecord['status'];
        } else if (effect.statusField === 'archive_status') {
          updateInput.archiveStatus = effect.newValue as ArchiveRecord['archiveStatus'];
        }
      }
    }

    // 更新档案记录
    const updatedRecord = this.archiveRepo.update(archiveId, updateInput);

    // 写入主变更日志
    this.logRepo.create({
      archiveId,
      statusField: result.statusField!,
      previousValue: result.previousValue ?? null,
      newValue: result.newValue!,
      action,
      operatorId,
      operatorName,
    });

    // 写入副作用变更日志
    if (result.sideEffects) {
      for (const effect of result.sideEffects) {
        this.logRepo.create({
          archiveId,
          statusField: effect.statusField,
          previousValue: effect.previousValue,
          newValue: effect.newValue,
          action,
          operatorId,
          operatorName,
        });
      }
    }

    return {
      success: true,
      record: updatedRecord!,
    };
  }

  /**
   * 批量执行档案状态流转
   * 逐条执行状态机校验，汇总成功/失败结果
   */
  executeBatchTransition(
    archiveIds: string[],
    action: TransitionAction,
    userRole: UserRole,
    operatorId: string,
    operatorName: string,
  ): BatchTransitionResponse {
    const results: BatchTransitionResponse['results'] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const archiveId of archiveIds) {
      const result = this.executeTransition(archiveId, action, userRole, operatorId, operatorName);
      if (result.success) {
        successCount++;
        results.push({ archiveId, success: true });
      } else {
        failureCount++;
        results.push({ archiveId, success: false, message: result.message });
      }
    }

    return { successCount, failureCount, results };
  }
}
