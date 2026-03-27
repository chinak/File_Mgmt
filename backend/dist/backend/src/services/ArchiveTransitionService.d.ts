/**
 * 档案状态流转服务
 * 整合状态机校验、档案记录更新、状态变更日志记录三个步骤
 * 每次成功的状态变更后，自动写入 status_change_logs 表
 *
 * 特殊处理：
 * - review_pass 联动：status 变更 + archive_status 变更，产生两条日志
 * - confirm_return_received 自动判断：branch_received 后可能产生额外的 status 变更日志
 */
import type { TransitionAction, UserRole, TransitionResponse, BatchTransitionResponse } from '../../shared/types';
import { StateMachineService } from './StateMachineService';
import { ArchiveRepository } from '../models/ArchiveRepository';
import { StatusChangeLogRepository } from '../models/StatusChangeLogRepository';
export declare class ArchiveTransitionService {
    private stateMachine;
    private archiveRepo;
    private logRepo;
    constructor(stateMachine: StateMachineService, archiveRepo: ArchiveRepository, logRepo: StatusChangeLogRepository);
    /**
     * 执行档案状态流转
     * 1. 查询档案记录
     * 2. 调用状态机校验转换合法性
     * 3. 更新档案记录对应的状态字段（含联动副作用）
     * 4. 写入状态变更日志（主变更 + 副作用变更）
     */
    executeTransition(archiveId: string, action: TransitionAction, userRole: UserRole, operatorId: string, operatorName: string): TransitionResponse;
    /**
     * 批量执行档案状态流转
     * 逐条执行状态机校验，汇总成功/失败结果
     */
    executeBatchTransition(archiveIds: string[], action: TransitionAction, userRole: UserRole, operatorId: string, operatorName: string): BatchTransitionResponse;
}
//# sourceMappingURL=ArchiveTransitionService.d.ts.map