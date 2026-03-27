/**
 * 档案控制器
 * 处理 Excel 导入、模板下载和档案查询请求
 */
import { Request, Response } from 'express';
/**
 * POST /api/archives/import
 * 接收 Excel 文件，解析并批量导入档案记录
 */
export declare function importArchives(req: Request, res: Response): void;
/**
 * GET /api/archives/template
 * 返回包含标准列头的 Excel 模板文件流
 */
export declare function downloadTemplate(_req: Request, res: Response): void;
/**
 * GET /api/archives
 * 查询档案记录列表，支持多条件组合查询和分页
 * 分支机构用户自动过滤为本营业部数据
 */
export declare function queryArchives(req: Request, res: Response): void;
/**
 * GET /api/archives/:id
 * 获取档案记录完整详情，包含状态变更历史（按时间倒序）
 */
export declare function getArchiveDetail(req: Request, res: Response): void;
/**
 * POST /api/archives/:id/transition
 * 执行单条档案记录的状态流转
 * 调用 StateMachineService 校验，成功后返回更新后的记录，失败返回对应错误信息
 */
export declare function transitionArchive(req: Request, res: Response): void;
/**
 * POST /api/archives/batch-transition
 * 批量执行档案记录的状态流转
 * 支持批量确认寄出（branch）和批量确认入库（general_affairs）
 * 逐条执行状态机校验，汇总成功/失败结果
 */
export declare function batchTransitionArchive(req: Request, res: Response): void;
/**
 * POST /api/archives
 * 创建新档案记录
 * 仅运营人员可操作
 */
export declare function createArchive(req: Request, res: Response): void;
/**
 * PUT /api/archives/:id
 * 编辑档案记录基础信息
 * 仅运营人员可操作，完全完结的记录不可编辑
 */
export declare function editArchive(req: Request, res: Response): void;
//# sourceMappingURL=archiveController.d.ts.map