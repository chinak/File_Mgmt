/**
 * 档案控制器
 * 处理 Excel 导入、模板下载和档案查询请求
 */

import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { ImportService } from '../services/ImportService';
import { ArchiveService } from '../services/ArchiveService';
import { ArchiveRepository } from '../models/ArchiveRepository';
import { StatusChangeLogRepository } from '../models/StatusChangeLogRepository';
import { getDatabase } from '../database';
import type {
  MainStatus,
  ArchiveSubStatus,
  ContractVersionType,
  ArchiveDetailResponse,
  TransitionAction,
  TransitionRequest,
  BatchTransitionRequest,
} from '@shared/types';
import { StateMachineService } from '../services/StateMachineService';
import { ArchiveTransitionService } from '../services/ArchiveTransitionService';

/** 允许的 Excel 文件扩展名 */
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];

/** 模板列头（标准字段） */
const TEMPLATE_COLUMNS = ['客户姓名', '资金账号', '营业部', '合同类型', '开户日期', '合同版本类型'];

/**
 * 校验文件扩展名是否为合法的 Excel 格式
 */
function isValidExcelFile(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * POST /api/archives/import
 * 接收 Excel 文件，解析并批量导入档案记录
 */
export function importArchives(req: Request, res: Response): void {
  const file = req.file;

  // 校验是否上传了文件
  if (!file) {
    res.status(400).json({
      code: 'INVALID_FILE',
      message: '文件格式不正确，请上传 Excel 文件',
    });
    return;
  }

  // 校验文件格式
  if (!isValidExcelFile(file.originalname)) {
    res.status(400).json({
      code: 'INVALID_FILE_FORMAT',
      message: '文件格式不正确，请上传 Excel 文件',
    });
    return;
  }

  // 调用 ImportService 执行导入
  const db = getDatabase();
  const archiveRepo = new ArchiveRepository(db);
  const importService = new ImportService(archiveRepo);

  const result = importService.importFromBuffer(file.buffer);
  res.json(result);
}

/**
 * GET /api/archives/template
 * 返回包含标准列头的 Excel 模板文件流
 */
export function downloadTemplate(_req: Request, res: Response): void {
  // 创建工作簿和工作表
  const workbook = XLSX.utils.book_new();
  const worksheetData = [TEMPLATE_COLUMNS];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  XLSX.utils.book_append_sheet(workbook, worksheet, '导入模板');

  // 生成 Buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // 设置响应头，返回文件流
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=archive_import_template.xlsx');
  res.send(buffer);
}

/**
 * GET /api/archives
 * 查询档案记录列表，支持多条件组合查询和分页
 * 分支机构用户自动过滤为本营业部数据
 */
export function queryArchives(req: Request, res: Response): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: '未提供认证令牌',
    });
    return;
  }

  // 从查询参数中提取查询条件
  const {
    customerName,
    fundAccount,
    branchName,
    contractType,
    status,
    archiveStatus,
    contractVersionType,
    openDateStart,
    openDateEnd,
    page,
    pageSize,
  } = req.query;

  const db = getDatabase();
  const archiveRepo = new ArchiveRepository(db);
  const archiveService = new ArchiveService(archiveRepo);

  const result = archiveService.query(
    {
      customerName: customerName as string | undefined,
      fundAccount: fundAccount as string | undefined,
      branchName: branchName as string | undefined,
      contractType: contractType as string | undefined,
      status: status as MainStatus | undefined,
      archiveStatus: archiveStatus as ArchiveSubStatus | undefined,
      contractVersionType: contractVersionType as ContractVersionType | undefined,
      openDateStart: openDateStart as string | undefined,
      openDateEnd: openDateEnd as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
    },
    user.role,
    user.branchName,
  );

  res.json(result);
}

/**
 * GET /api/archives/:id
 * 获取档案记录完整详情，包含状态变更历史（按时间倒序）
 */
export function getArchiveDetail(req: Request, res: Response): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: '未提供认证令牌',
    });
    return;
  }

  const id = req.params['id'] as string;

  const db = getDatabase();
  const archiveRepo = new ArchiveRepository(db);
  const logRepo = new StatusChangeLogRepository(db);

  // 查询档案记录
  const record = archiveRepo.findById(id);
  if (!record) {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: '档案记录不存在',
    });
    return;
  }

  // 查询状态变更历史（按时间倒序）
  const statusHistory = logRepo.findByArchiveId(id);

  const response: ArchiveDetailResponse = {
    record,
    statusHistory,
  };

  res.json(response);
}

/** 合法的状态流转操作值 */
const VALID_ACTIONS: readonly TransitionAction[] = [
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

/**
 * POST /api/archives/:id/transition
 * 执行单条档案记录的状态流转
 * 调用 StateMachineService 校验，成功后返回更新后的记录，失败返回对应错误信息
 */
export function transitionArchive(req: Request, res: Response): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: '未提供认证令牌',
    });
    return;
  }

  const id = req.params['id'] as string;
  const { action } = req.body as TransitionRequest;

  // 校验 action 参数
  if (!action || !(VALID_ACTIONS as readonly string[]).includes(action)) {
    res.status(400).json({
      code: 'INVALID_ACTION',
      message: '无效的状态流转操作',
    });
    return;
  }

  const db = getDatabase();
  const archiveRepo = new ArchiveRepository(db);
  const logRepo = new StatusChangeLogRepository(db);
  const stateMachine = new StateMachineService();
  const transitionService = new ArchiveTransitionService(stateMachine, archiveRepo, logRepo);

  const result = transitionService.executeTransition(
    id,
    action,
    user.role,
    user.userId,
    user.username,
  );

  if (!result.success) {
    // 根据错误类型返回不同的 HTTP 状态码
    const statusCode = result.message === '档案记录不存在' ? 404 : 400;
    res.status(statusCode).json({
      code: 'TRANSITION_FAILED',
      message: result.message,
    });
    return;
  }

  res.json({
    success: true,
    record: result.record,
  });
}

/** 批量操作支持所有状态流转操作 */
const BATCH_ALLOWED_ACTIONS: readonly TransitionAction[] = [
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

/**
 * POST /api/archives/batch-transition
 * 批量执行档案记录的状态流转
 * 支持批量确认寄出（branch）和批量确认入库（general_affairs）
 * 逐条执行状态机校验，汇总成功/失败结果
 */
export function batchTransitionArchive(req: Request, res: Response): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: '未提供认证令牌',
    });
    return;
  }

  const { archiveIds, action } = req.body as BatchTransitionRequest;

  // 校验 archiveIds 参数
  if (!archiveIds || !Array.isArray(archiveIds) || archiveIds.length === 0) {
    res.status(400).json({
      code: 'INVALID_PARAMS',
      message: '请至少选择一条档案记录',
    });
    return;
  }

  // 校验 action 参数，批量操作仅支持 confirm_shipment 和 confirm_archive
  if (!action || !(BATCH_ALLOWED_ACTIONS as readonly string[]).includes(action)) {
    res.status(400).json({
      code: 'INVALID_ACTION',
      message: '无效的批量状态流转操作',
    });
    return;
  }

  const db = getDatabase();
  const archiveRepo = new ArchiveRepository(db);
  const logRepo = new StatusChangeLogRepository(db);
  const stateMachine = new StateMachineService();
  const transitionService = new ArchiveTransitionService(stateMachine, archiveRepo, logRepo);

  const result = transitionService.executeBatchTransition(
    archiveIds,
    action,
    user.role,
    user.userId,
    user.username,
  );

  res.json(result);
}
/**
 * POST /api/archives
 * 创建新档案记录
 * 仅运营人员可操作
 */
export function createArchive(req: Request, res: Response): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: '未提供认证令牌',
    });
    return;
  }

  const { customerName, fundAccount, branchName, contractType, openDate, contractVersionType } = req.body;

  // 校验必填字段
  if (!customerName || !fundAccount || !branchName || !contractType || !openDate || !contractVersionType) {
    res.status(400).json({
      code: 'INVALID_PARAMS',
      message: '缺少必填字段',
    });
    return;
  }

  // 校验合同版本类型
  if (!['electronic', 'paper'].includes(contractVersionType)) {
    res.status(400).json({
      code: 'INVALID_CONTRACT_VERSION_TYPE',
      message: '合同版本类型无效',
    });
    return;
  }

  const db = getDatabase();
  const archiveRepo = new ArchiveRepository(db);

  // 检查资金账号是否已存在
  const existing = archiveRepo.findByFundAccount(fundAccount);
  if (existing) {
    res.status(409).json({
      code: 'DUPLICATE_FUND_ACCOUNT',
      message: '资金账号已存在',
    });
    return;
  }

  // 根据合同版本类型设置初始状态
  // 电子版：status = null, archive_status = archived（创建即完结）
  // 纸质版：status = pending_shipment, archive_status = archive_not_started
  const isElectronic = contractVersionType === 'electronic';
  const initialStatus: MainStatus | null = isElectronic ? null : 'pending_shipment';
  const initialArchiveStatus: ArchiveSubStatus = isElectronic ? 'archived' : 'archive_not_started';

  // 创建新档案记录
  const record = archiveRepo.create({
    customerName,
    fundAccount,
    branchName,
    contractType,
    openDate,
    contractVersionType,
    status: initialStatus,
    archiveStatus: initialArchiveStatus,
  });

  res.json({
    success: true,
    record,
  });
}

/**
 * PUT /api/archives/:id
 * 编辑档案记录基础信息
 * 仅运营人员可操作，完全完结的记录不可编辑
 */
export function editArchive(req: Request, res: Response): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: '未提供认证令牌' });
    return;
  }

  const id = req.params['id'] as string;
  const { customerName, fundAccount, branchName, contractType, openDate, contractVersionType } = req.body;

  const db = getDatabase();
  const archiveRepo = new ArchiveRepository(db);

  const record = archiveRepo.findById(id);
  if (!record) {
    res.status(404).json({ code: 'NOT_FOUND', message: '档案记录不存在' });
    return;
  }

  // 完全完结的记录不可编辑
  if (record.status === 'completed') {
    res.status(400).json({ code: 'FULLY_COMPLETED', message: '该记录已完全完结，不可修改' });
    return;
  }

  // 资金账号唯一性校验
  if (fundAccount && fundAccount !== record.fundAccount) {
    const existing = archiveRepo.findByFundAccount(fundAccount);
    if (existing) {
      res.status(409).json({ code: 'DUPLICATE_FUND_ACCOUNT', message: '资金账号已存在' });
      return;
    }
  }

  const updated = archiveRepo.editBasicInfo(id, {
    customerName,
    fundAccount,
    branchName,
    contractType,
    openDate,
    contractVersionType,
  });

  res.json({ success: true, record: updated });
}
