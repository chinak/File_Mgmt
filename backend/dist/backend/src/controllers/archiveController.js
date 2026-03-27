"use strict";
/**
 * 档案控制器
 * 处理 Excel 导入、模板下载和档案查询请求
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.importArchives = importArchives;
exports.downloadTemplate = downloadTemplate;
exports.queryArchives = queryArchives;
exports.getArchiveDetail = getArchiveDetail;
exports.transitionArchive = transitionArchive;
exports.batchTransitionArchive = batchTransitionArchive;
exports.createArchive = createArchive;
exports.editArchive = editArchive;
const XLSX = __importStar(require("xlsx"));
const ImportService_1 = require("../services/ImportService");
const ArchiveService_1 = require("../services/ArchiveService");
const ArchiveRepository_1 = require("../models/ArchiveRepository");
const StatusChangeLogRepository_1 = require("../models/StatusChangeLogRepository");
const database_1 = require("../database");
const StateMachineService_1 = require("../services/StateMachineService");
const ArchiveTransitionService_1 = require("../services/ArchiveTransitionService");
/** 允许的 Excel 文件扩展名 */
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];
/** 模板列头（标准字段） */
const TEMPLATE_COLUMNS = ['客户姓名', '资金账号', '营业部', '合同类型', '开户日期', '合同版本类型'];
/**
 * 校验文件扩展名是否为合法的 Excel 格式
 */
function isValidExcelFile(filename) {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
}
/**
 * POST /api/archives/import
 * 接收 Excel 文件，解析并批量导入档案记录
 */
function importArchives(req, res) {
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
    const db = (0, database_1.getDatabase)();
    const archiveRepo = new ArchiveRepository_1.ArchiveRepository(db);
    const importService = new ImportService_1.ImportService(archiveRepo);
    const result = importService.importFromBuffer(file.buffer);
    res.json(result);
}
/**
 * GET /api/archives/template
 * 返回包含标准列头的 Excel 模板文件流
 */
function downloadTemplate(_req, res) {
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
function queryArchives(req, res) {
    const user = req.user;
    if (!user) {
        res.status(401).json({
            code: 'UNAUTHORIZED',
            message: '未提供认证令牌',
        });
        return;
    }
    // 从查询参数中提取查询条件
    const { customerName, fundAccount, branchName, contractType, status, archiveStatus, contractVersionType, openDateStart, openDateEnd, page, pageSize, } = req.query;
    const db = (0, database_1.getDatabase)();
    const archiveRepo = new ArchiveRepository_1.ArchiveRepository(db);
    const archiveService = new ArchiveService_1.ArchiveService(archiveRepo);
    const result = archiveService.query({
        customerName: customerName,
        fundAccount: fundAccount,
        branchName: branchName,
        contractType: contractType,
        status: status,
        archiveStatus: archiveStatus,
        contractVersionType: contractVersionType,
        openDateStart: openDateStart,
        openDateEnd: openDateEnd,
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    }, user.role, user.branchName);
    res.json(result);
}
/**
 * GET /api/archives/:id
 * 获取档案记录完整详情，包含状态变更历史（按时间倒序）
 */
function getArchiveDetail(req, res) {
    const user = req.user;
    if (!user) {
        res.status(401).json({
            code: 'UNAUTHORIZED',
            message: '未提供认证令牌',
        });
        return;
    }
    const id = req.params['id'];
    const db = (0, database_1.getDatabase)();
    const archiveRepo = new ArchiveRepository_1.ArchiveRepository(db);
    const logRepo = new StatusChangeLogRepository_1.StatusChangeLogRepository(db);
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
    const response = {
        record,
        statusHistory,
    };
    res.json(response);
}
/** 合法的状态流转操作值 */
const VALID_ACTIONS = [
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
/**
 * POST /api/archives/:id/transition
 * 执行单条档案记录的状态流转
 * 调用 StateMachineService 校验，成功后返回更新后的记录，失败返回对应错误信息
 */
function transitionArchive(req, res) {
    const user = req.user;
    if (!user) {
        res.status(401).json({
            code: 'UNAUTHORIZED',
            message: '未提供认证令牌',
        });
        return;
    }
    const id = req.params['id'];
    const { action } = req.body;
    // 校验 action 参数
    if (!action || !VALID_ACTIONS.includes(action)) {
        res.status(400).json({
            code: 'INVALID_ACTION',
            message: '无效的状态流转操作',
        });
        return;
    }
    const db = (0, database_1.getDatabase)();
    const archiveRepo = new ArchiveRepository_1.ArchiveRepository(db);
    const logRepo = new StatusChangeLogRepository_1.StatusChangeLogRepository(db);
    const stateMachine = new StateMachineService_1.StateMachineService();
    const transitionService = new ArchiveTransitionService_1.ArchiveTransitionService(stateMachine, archiveRepo, logRepo);
    const result = transitionService.executeTransition(id, action, user.role, user.userId, user.username);
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
const BATCH_ALLOWED_ACTIONS = [
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
/**
 * POST /api/archives/batch-transition
 * 批量执行档案记录的状态流转
 * 支持批量确认寄出（branch）和批量确认入库（general_affairs）
 * 逐条执行状态机校验，汇总成功/失败结果
 */
function batchTransitionArchive(req, res) {
    const user = req.user;
    if (!user) {
        res.status(401).json({
            code: 'UNAUTHORIZED',
            message: '未提供认证令牌',
        });
        return;
    }
    const { archiveIds, action } = req.body;
    // 校验 archiveIds 参数
    if (!archiveIds || !Array.isArray(archiveIds) || archiveIds.length === 0) {
        res.status(400).json({
            code: 'INVALID_PARAMS',
            message: '请至少选择一条档案记录',
        });
        return;
    }
    // 校验 action 参数，批量操作仅支持 confirm_shipment 和 confirm_archive
    if (!action || !BATCH_ALLOWED_ACTIONS.includes(action)) {
        res.status(400).json({
            code: 'INVALID_ACTION',
            message: '无效的批量状态流转操作',
        });
        return;
    }
    const db = (0, database_1.getDatabase)();
    const archiveRepo = new ArchiveRepository_1.ArchiveRepository(db);
    const logRepo = new StatusChangeLogRepository_1.StatusChangeLogRepository(db);
    const stateMachine = new StateMachineService_1.StateMachineService();
    const transitionService = new ArchiveTransitionService_1.ArchiveTransitionService(stateMachine, archiveRepo, logRepo);
    const result = transitionService.executeBatchTransition(archiveIds, action, user.role, user.userId, user.username);
    res.json(result);
}
/**
 * POST /api/archives
 * 创建新档案记录
 * 仅运营人员可操作
 */
function createArchive(req, res) {
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
    const db = (0, database_1.getDatabase)();
    const archiveRepo = new ArchiveRepository_1.ArchiveRepository(db);
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
    const initialStatus = isElectronic ? null : 'pending_shipment';
    const initialArchiveStatus = isElectronic ? 'archived' : 'archive_not_started';
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
function editArchive(req, res) {
    const user = req.user;
    if (!user) {
        res.status(401).json({ code: 'UNAUTHORIZED', message: '未提供认证令牌' });
        return;
    }
    const id = req.params['id'];
    const { customerName, fundAccount, branchName, contractType, openDate, contractVersionType } = req.body;
    const db = (0, database_1.getDatabase)();
    const archiveRepo = new ArchiveRepository_1.ArchiveRepository(db);
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
//# sourceMappingURL=archiveController.js.map