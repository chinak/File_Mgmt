// ============================================================
// 档案管理系统 - 共享类型定义
// 前后端共用的类型、枚举和接口
// ============================================================

// -------------------- 枚举类型 --------------------

/** 用户角色 */
export type UserRole = 'operator' | 'branch' | 'general_affairs';

/** 合同版本类型 */
export type ContractVersionType = 'electronic' | 'paper';

/** 主流程状态（8个状态值） */
export type MainStatus =
  | 'pending_shipment'      // 待分支机构寄出
  | 'in_transit'            // 寄送总部在途
  | 'hq_received'           // 总部已收到
  | 'review_passed'         // 审核通过
  | 'review_rejected'       // 审核不通过
  | 'pending_return'        // 待总部回寄
  | 'return_in_transit'     // 总部回寄在途
  | 'branch_received';      // 分支已确认收到

/** 综合部归档状态（4个状态值） */
export type ArchiveSubStatus =
  | 'archive_not_started'   // 归档待启动
  | 'pending_transfer'      // 待转交
  | 'pending_archive'       // 待综合部入库
  | 'archived';             // 已归档-完结

/** 状态流转操作（9个操作） */
export type TransitionAction =
  | 'confirm_shipment'        // 分支确认寄出
  | 'confirm_received'        // 运营确认收到
  | 'review_pass'             // 运营审核通过
  | 'review_reject'           // 运营审核不通过
  | 'return_branch'           // 运营回寄分支
  | 'confirm_shipped_back'    // 运营确认已寄出
  | 'confirm_return_received' // 分支确认收到回寄
  | 'transfer_general'        // 运营转交综合部
  | 'confirm_archive';        // 综合部确认入库

// -------------------- 核心实体接口 --------------------

/** 档案记录 */
export interface ArchiveRecord {
  id: string;                                    // 主键
  customerName: string;                          // 客户姓名
  fundAccount: string;                           // 资金账号（唯一）
  branchName: string;                            // 营业部
  contractType: string;                          // 合同类型
  openDate: string;                              // 开户日期 (YYYY-MM-DD)
  contractVersionType: ContractVersionType;      // 合同版本类型
  status: MainStatus | 'completed' | null;       // 主流程状态（电子版为 null，完全完结为 completed）
  archiveStatus: ArchiveSubStatus;               // 综合部归档状态
  scanFileUrl?: string;                          // 扫描件文件 URL
  createdAt: string;                             // 创建时间
  updatedAt: string;                             // 更新时间
}

/** 状态变更日志 */
export interface StatusChangeLog {
  id: string;                           // 主键
  archiveId: string;                    // 关联档案记录 ID
  statusField: string;                  // 变更的状态字段名（status / archive_status）
  previousValue: string | null;         // 变更前状态值
  newValue: string;                     // 变更后状态值
  action: TransitionAction | 'create';  // 触发操作
  operatorId: string;                   // 操作人 ID
  operatorName: string;                 // 操作人姓名
  operatedAt: string;                   // 操作时间
}

/** 用户 */
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  branchName?: string;                  // 分支机构所属营业部
  createdAt: string;
}

// -------------------- 权限相关 --------------------

/** 权限类型 */
export type Permission =
  | 'import'
  | 'search'
  | 'review'
  | 'return_branch'
  | 'confirm_received'
  | 'review_reject'
  | 'confirm_shipped_back'
  | 'transfer_general'
  | 'upload_scan'
  | 'ocr'
  | 'view_own_archives'
  | 'confirm_shipment'
  | 'confirm_return_received'
  | 'confirm_archive';

// -------------------- API 请求/响应接口 --------------------

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
  customerName: string;                          // 客户姓名
  fundAccount: string;                           // 资金账号（唯一）
  branchName: string;                            // 营业部
  contractType: string;                          // 合同类型
  openDate: string;                              // 开户日期 (YYYY-MM-DD)
  contractVersionType: ContractVersionType;      // 合同版本类型
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

// -------------------- OCR 相关接口 --------------------

/** OCR 识别字段 */
export interface OcrField {
  value: string;
  confidence: number; // 0-1，低于阈值需人工复核
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

// -------------------- 错误响应接口 --------------------

/** 统一错误响应 */
export interface ErrorResponse {
  code: string;        // 错误码
  message: string;     // 用户可读的错误信息
  details?: unknown;   // 可选的详细信息
}

// -------------------- 常量值集合（用于运行时校验） --------------------

/** 所有合法的用户角色值 */
export const USER_ROLES: readonly UserRole[] = ['operator', 'branch', 'general_affairs'] as const;

/** 所有合法的合同版本类型值 */
export const CONTRACT_VERSION_TYPES: readonly ContractVersionType[] = ['electronic', 'paper'] as const;

/** 所有合法的主流程状态值 */
export const MAIN_STATUSES: readonly MainStatus[] = [
  'pending_shipment',
  'in_transit',
  'hq_received',
  'review_passed',
  'review_rejected',
  'pending_return',
  'return_in_transit',
  'branch_received',
] as const;

/** 所有合法的综合部归档状态值 */
export const ARCHIVE_SUB_STATUSES: readonly ArchiveSubStatus[] = [
  'archive_not_started',
  'pending_transfer',
  'pending_archive',
  'archived',
] as const;

/** 所有合法的状态流转操作值 */
export const TRANSITION_ACTIONS: readonly TransitionAction[] = [
  'confirm_shipment',
  'confirm_received',
  'review_pass',
  'review_reject',
  'return_branch',
  'confirm_shipped_back',
  'confirm_return_received',
  'transfer_general',
  'confirm_archive',
] as const;
