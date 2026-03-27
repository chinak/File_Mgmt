/**
 * 状态机服务
 * 控制档案记录的状态流转逻辑，包括主流程状态（status）和综合部归档状态（archive_status）两个字段的合法转换
 */
import type { ArchiveRecord, MainStatus, ArchiveSubStatus, TransitionAction, UserRole } from '../../shared/types';
/** 状态流转结果 */
export interface TransitionResult {
    success: boolean;
    statusField?: 'status' | 'archive_status';
    previousValue?: string | null;
    newValue?: string;
    error?: string;
    /** 联动产生的副作用（如 review_pass 联动 archive_status，或 confirm_return_received 自动判断） */
    sideEffects?: Array<{
        statusField: 'status' | 'archive_status';
        previousValue: string | null;
        newValue: string;
    }>;
}
/** 主流程状态合法转换表（8个状态值） */
export declare const MAIN_STATUS_TRANSITIONS: Record<MainStatus, Partial<Record<TransitionAction, MainStatus>>>;
/** 综合部归档状态合法转换表（4个状态值） */
export declare const ARCHIVE_STATUS_TRANSITIONS: Record<ArchiveSubStatus, Partial<Record<TransitionAction, ArchiveSubStatus>>>;
/** 操作-角色权限映射表 */
export declare const ACTION_ROLE_MAP: Record<TransitionAction, UserRole>;
export declare class StateMachineService {
    /**
     * 执行状态流转
     * 根据 action 类型判断操作哪个状态字段，校验当前状态是否允许该转换，校验用户角色是否匹配
     *
     * 前置校验顺序：
     * 1. 电子版合同保护：电子版合同拒绝所有状态变更操作
     * 2. 完全完结保护：完全完结记录拒绝所有状态变更操作
     * 3. 角色权限校验：操作角色必须匹配
     */
    transition(record: ArchiveRecord, action: TransitionAction, userRole: UserRole): TransitionResult;
    /** 主流程状态转换 */
    private transitionMainStatus;
    /** 综合部归档状态转换 */
    private transitionArchiveStatus;
    /**
     * 判断记录是否完全完结
     * 当 status === 'completed' 时，记录完全完结
     */
    isFullyCompleted(record: ArchiveRecord): boolean;
}
//# sourceMappingURL=StateMachineService.d.ts.map