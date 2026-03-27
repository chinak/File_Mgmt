/** 用户角色 */
export type UserRole = 'operator' | 'branch' | 'general_affairs';
/** 合同版本类型 */
export type ContractVersionType = 'electronic' | 'paper';
/** 主流程状态（8个状态值） */
export type MainStatus = 'pending_shipment' | 'in_transit' | 'hq_received' | 'review_passed' | 'review_rejected' | 'pending_return' | 'return_in_transit' | 'branch_received';
/** 综合部归档状态（4个状态值） */
export type ArchiveSubStatus = 'archive_not_started' | 'pending_transfer' | 'pending_archive' | 'archived';
/** 状态流转操作（9个操作） */
export type TransitionAction = 'confirm_shipment' | 'confirm_received' | 'review_pass' | 'review_reject' | 'return_branch' | 'confirm_shipped_back' | 'confirm_return_received' | 'transfer_general' | 'confirm_archive';
/** 档案记录 */
export interface ArchiveRecord {
    id: string;
    customerName: string;
    fundAccount: string;
    branchName: string;
    contractType: string;
    openDate: string;
    contractVersionType: ContractVersionType;
    status: MainStatus | 'completed' | null;
    archiveStatus: ArchiveSubStatus;
    scanFileUrl?: string;
    createdAt: string;
    updatedAt: string;
}
/** 状态变更日志 */
export interface StatusChangeLog {
    id: string;
    archiveId: string;
    statusField: string;
    previousValue: string | null;
    newValue: string;
    action: TransitionAction | 'create';
    operatorId: string;
    operatorName: string;
    operatedAt: string;
}
/** 用户 */
export interface User {
    id: string;
    username: string;
    passwordHash: string;
    role: UserRole;
    branchName?: string;
    createdAt: string;
}
/** 权限类型 */
export type Permission = 'import' | 'search' | 'review' | 'return_branch' | 'confirm_received' | 'review_reject' | 'confirm_shipped_back' | 'transfer_general' | 'upload_scan' | 'ocr' | 'view_own_archives' | 'confirm_shipment' | 'confirm_return_received' | 'confirm_archive';
/** 登录请求 */
export interface LoginRequest {
    username: string;
    password: string;
}
/** 登录响应 */
export interface LoginResponse {
    token: string;
    user: {
        id: string;
        username: string;
        role: UserRole;
        branchName?: string;
    };
}
/** 当前用户信息响应 */
export interface CurrentUserResponse {
    id: string;
    username: string;
    role: UserRole;
    branchName?: string;
    permissions: Permission[];
}
/** Excel 导入响应 */
export interface ImportResponse {
    totalRows: number;
    successCount: number;
    failureCount: number;
    errors: Array<{
        row: number;
        reason: string;
    }>;
}
/** 档案查询参数 */
export interface ArchiveQueryParams {
    customerName?: string;
    fundAccount?: string;
    branchName?: string;
    contractType?: string;
    status?: MainStatus;
    archiveStatus?: ArchiveSubStatus;
    contractVersionType?: ContractVersionType;
    openDateStart?: string;
    openDateEnd?: string;
    page: number;
    pageSize: number;
}
/** 档案列表响应 */
export interface ArchiveListResponse {
    total: number;
    page: number;
    pageSize: number;
    records: ArchiveRecord[];
}
/** 创建档案记录请求 */
export interface CreateArchiveRequest {
    customerName: string;
    fundAccount: string;
    branchName: string;
    contractType: string;
    openDate: string;
    contractVersionType: ContractVersionType;
}
/** 创建档案记录响应 */
export interface CreateArchiveResponse {
    success: boolean;
    record: ArchiveRecord;
    message?: string;
}
/** 档案详情响应 */
export interface ArchiveDetailResponse {
    record: ArchiveRecord;
    statusHistory: StatusChangeLog[];
}
/** 状态流转请求 */
export interface TransitionRequest {
    action: TransitionAction;
}
/** 状态流转响应 */
export interface TransitionResponse {
    success: boolean;
    record: ArchiveRecord;
    message?: string;
}
/** 批量状态流转请求 */
export interface BatchTransitionRequest {
    archiveIds: string[];
    action: TransitionAction;
}
/** 批量状态流转响应 */
export interface BatchTransitionResponse {
    successCount: number;
    failureCount: number;
    results: Array<{
        archiveId: string;
        success: boolean;
        message?: string;
    }>;
}
/** OCR 识别字段 */
export interface OcrField {
    value: string;
    confidence: number;
}
/** OCR 识别响应 */
export interface OcrResponse {
    success: boolean;
    fields: {
        customerName: OcrField;
        fundAccount: OcrField;
        branchName: OcrField;
        contractType: OcrField;
        openDate: OcrField;
        contractVersionType: OcrField;
    };
    rawText?: string;
}
/** 统一错误响应 */
export interface ErrorResponse {
    code: string;
    message: string;
    details?: unknown;
}
/** 所有合法的用户角色值 */
export declare const USER_ROLES: readonly UserRole[];
/** 所有合法的合同版本类型值 */
export declare const CONTRACT_VERSION_TYPES: readonly ContractVersionType[];
/** 所有合法的主流程状态值 */
export declare const MAIN_STATUSES: readonly MainStatus[];
/** 所有合法的综合部归档状态值 */
export declare const ARCHIVE_SUB_STATUSES: readonly ArchiveSubStatus[];
/** 所有合法的状态流转操作值 */
export declare const TRANSITION_ACTIONS: readonly TransitionAction[];
//# sourceMappingURL=types.d.ts.map