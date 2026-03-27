"use strict";
// ============================================================
// 档案管理系统 - 共享类型定义
// 前后端共用的类型、枚举和接口
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSITION_ACTIONS = exports.ARCHIVE_SUB_STATUSES = exports.MAIN_STATUSES = exports.CONTRACT_VERSION_TYPES = exports.USER_ROLES = void 0;
// -------------------- 常量值集合（用于运行时校验） --------------------
/** 所有合法的用户角色值 */
exports.USER_ROLES = ['operator', 'branch', 'general_affairs'];
/** 所有合法的合同版本类型值 */
exports.CONTRACT_VERSION_TYPES = ['electronic', 'paper'];
/** 所有合法的主流程状态值 */
exports.MAIN_STATUSES = [
    'pending_shipment',
    'in_transit',
    'hq_received',
    'review_passed',
    'review_rejected',
    'pending_return',
    'return_in_transit',
    'branch_received',
];
/** 所有合法的综合部归档状态值 */
exports.ARCHIVE_SUB_STATUSES = [
    'archive_not_started',
    'pending_transfer',
    'pending_archive',
    'archived',
];
/** 所有合法的状态流转操作值 */
exports.TRANSITION_ACTIONS = [
    'confirm_shipment',
    'confirm_received',
    'review_pass',
    'review_reject',
    'return_branch',
    'confirm_shipped_back',
    'confirm_return_received',
    'transfer_general',
    'confirm_archive',
];
//# sourceMappingURL=types.js.map