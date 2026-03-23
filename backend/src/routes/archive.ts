/**
 * 档案路由
 * 注册档案导入和模板下载的路由
 */

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { importArchives, downloadTemplate, queryArchives, getArchiveDetail, transitionArchive, batchTransitionArchive, editArchive, createArchive } from '../controllers/archiveController';

const router = Router();

/** 配置 multer 使用内存存储 */
const upload = multer({ storage: multer.memoryStorage() });

/** GET /api/archives - 查询档案列表（需认证，所有角色可查询，服务层控制数据隔离） */
router.get('/', authenticate, queryArchives);

/** POST /api/archives - 创建新档案记录（需认证 + review 权限） */
router.post('/', authenticate, authorize('review'), createArchive);

/** POST /api/archives/import - Excel 批量导入（需认证 + import 权限） */
router.post('/import', authenticate, authorize('import'), upload.single('file'), importArchives);

/** POST /api/archives/batch-transition - 批量状态流转（需认证，角色校验由状态机内部完成） */
router.post('/batch-transition', authenticate, batchTransitionArchive);

/** GET /api/archives/template - 下载导入模板（需认证，任意角色可下载） */
router.get('/template', authenticate, downloadTemplate);

/** GET /api/archives/:id - 获取档案详情（需认证，含状态变更历史） */
router.get('/:id', authenticate, getArchiveDetail);

/** POST /api/archives/:id/transition - 单条状态流转（需认证，角色校验由状态机内部完成） */
router.post('/:id/transition', authenticate, transitionArchive);

/** PUT /api/archives/:id - 编辑档案基础信息（需认证 + review 权限） */
router.put('/:id', authenticate, authorize('review'), editArchive);

export default router;
