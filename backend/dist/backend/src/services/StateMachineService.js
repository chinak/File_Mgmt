"use strict";
/**
 * 状态机服务
 * 控制档案记录的状态流转逻辑，包括主流程状态（status）和综合部归档状态（archive_status）两个字段的合法转换
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachineService = exports.ACTION_ROLE_MAP = exports.ARCHIVE_STATUS_TRANSITIONS = exports.MAIN_STATUS_TRANSITIONS = void 0;
/** 主流程状态合法转换表（8个状态值） */
exports.MAIN_STATUS_TRANSITIONS = {
    'pending_shipment': {
        'confirm_shipment': 'in_transit',
    },
    'in_transit': {
        'confirm_received': 'hq_received',
    },
    'hq_received': {
        'review_pass': 'review_passed',
        'review_reject': 'review_rejected',
    },
    'review_passed': {
        'return_branch': 'pending_return',
    },
    'review_rejected': {
        'return_branch': 'pending_return',
    },
    'pending_return': {
        'confirm_shipped_back': 'return_in_transit',
    },
    'return_in_transit': {
        'confirm_return_received': 'branch_received',
    },
    'branch_received': {}, // 自动判断：回退或完结
};
/** 综合部归档状态合法转换表（4个状态值） */
exports.ARCHIVE_STATUS_TRANSITIONS = {
    'archive_not_started': {
    // review_pass 时自动激活为 pending_transfer（由状态机内部处理）
    },
    'pending_transfer': {
        'transfer_general': 'pending_archive',
    },
    'pending_archive': {
        'confirm_archive': 'archived',
    },
    'archived': {}, // 终态
};
/** 操作-角色权限映射表 */
exports.ACTION_ROLE_MAP = {
    'confirm_shipment': 'branch',
    'confirm_received': 'operator',
    'review_pass': 'operator',
    'review_reject': 'operator',
    'return_branch': 'operator',
    'confirm_shipped_back': 'operator',
    'confirm_return_received': 'branch',
    'transfer_general': 'operator',
    'confirm_archive': 'general_affairs',
};
/** 操作对应的状态字段映射 */
const ACTION_STATUS_FIELD_MAP = {
    'confirm_shipment': 'status',
    'confirm_received': 'status',
    'review_pass': 'status',
    'review_reject': 'status',
    'return_branch': 'status',
    'confirm_shipped_back': 'status',
    'confirm_return_received': 'status',
    'transfer_general': 'archive_status',
    'confirm_archive': 'archive_status',
};
class StateMachineService {
    /**
     * 执行状态流转
     * 根据 action 类型判断操作哪个状态字段，校验当前状态是否允许该转换，校验用户角色是否匹配
     *
     * 前置校验顺序：
     * 1. 电子版合同保护：电子版合同拒绝所有状态变更操作
     * 2. 完全完结保护：完全完结记录拒绝所有状态变更操作
     * 3. 角色权限校验：操作角色必须匹配
     */
    transition(record, action, userRole) {
        // 前置校验1：电子版合同拒绝所有状态变更操作
        if (record.contractVersionType === 'electronic') {
            return {
                success: false,
                error: '电子版合同无需执行此操作',
            };
        }
        // 前置校验2：完全完结记录拒绝所有状态变更操作
        if (this.isFullyCompleted(record)) {
            return {
                success: false,
                error: '该记录已完全完结，不可修改',
            };
        }
        // 校验用户角色是否匹配
        const requiredRole = exports.ACTION_ROLE_MAP[action];
        if (userRole !== requiredRole) {
            return {
                success: false,
                error: '权限不足',
            };
        }
        // 根据 action 确定操作的状态字段
        const statusField = ACTION_STATUS_FIELD_MAP[action];
        // 根据状态字段类型查找对应的转换表并执行转换
        switch (statusField) {
            case 'status':
                return this.transitionMainStatus(record, action);
            case 'archive_status':
                return this.transitionArchiveStatus(record, action);
        }
    }
    /** 主流程状态转换 */
    transitionMainStatus(record, action) {
        const currentStatus = record.status;
        // 主流程状态为 null 时（电子版），不允许转换
        if (currentStatus === null || currentStatus === 'completed') {
            return {
                success: false,
                error: '状态流转不合法',
            };
        }
        const transitions = exports.MAIN_STATUS_TRANSITIONS[currentStatus];
        const newStatus = transitions?.[action];
        if (!newStatus) {
            return {
                success: false,
                error: '状态流转不合法',
            };
        }
        const result = {
            success: true,
            statusField: 'status',
            previousValue: currentStatus,
            newValue: newStatus,
        };
        // review_pass 联动逻辑：同时将 archive_status 从 archive_not_started → pending_transfer
        if (action === 'review_pass' && record.archiveStatus === 'archive_not_started') {
            result.sideEffects = [{
                    statusField: 'archive_status',
                    previousValue: record.archiveStatus,
                    newValue: 'pending_transfer',
                }];
        }
        // confirm_return_received 自动判断逻辑：branch_received 后根据 archive_status 决定后续
        if (action === 'confirm_return_received' && newStatus === 'branch_received') {
            if (record.archiveStatus === 'archive_not_started') {
                // 审核不通过路径：自动回退到 pending_shipment
                result.sideEffects = [{
                        statusField: 'status',
                        previousValue: 'branch_received',
                        newValue: 'pending_shipment',
                    }];
            }
            else if (record.archiveStatus === 'archived') {
                // 归档已完成：自动完结
                result.sideEffects = [{
                        statusField: 'status',
                        previousValue: 'branch_received',
                        newValue: 'completed',
                    }];
            }
            // archive_status 为 pending_transfer 或 pending_archive 时，status 保持 branch_received
        }
        return result;
    }
    /** 综合部归档状态转换 */
    transitionArchiveStatus(record, action) {
        const currentStatus = record.archiveStatus;
        const transitions = exports.ARCHIVE_STATUS_TRANSITIONS[currentStatus];
        const newStatus = transitions?.[action];
        if (!newStatus) {
            // 根据当前状态提供更具体的错误信息
            if (currentStatus === 'pending_archive' && action === 'transfer_general') {
                return {
                    success: false,
                    error: '该记录已完成转交综合部',
                };
            }
            if (currentStatus === 'archived') {
                if (action === 'transfer_general') {
                    return {
                        success: false,
                        error: '该记录已完成转交综合部',
                    };
                }
                return {
                    success: false,
                    error: '状态流转不合法',
                };
            }
            return {
                success: false,
                error: '状态流转不合法',
            };
        }
        return {
            success: true,
            statusField: 'archive_status',
            previousValue: currentStatus,
            newValue: newStatus,
        };
    }
    /**
     * 判断记录是否完全完结
     * 当 status === 'completed' 时，记录完全完结
     */
    isFullyCompleted(record) {
        return record.status === 'completed';
    }
}
exports.StateMachineService = StateMachineService;
//# sourceMappingURL=StateMachineService.js.map