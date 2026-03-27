"use strict";
/**
 * 档案路由
 * 注册档案导入和模板下载的路由
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middlewares/auth");
const authorize_1 = require("../middlewares/authorize");
const archiveController_1 = require("../controllers/archiveController");
const router = (0, express_1.Router)();
/** 配置 multer 使用内存存储 */
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
/** GET /api/archives - 查询档案列表（需认证，所有角色可查询，服务层控制数据隔离） */
router.get('/', auth_1.authenticate, archiveController_1.queryArchives);
/** POST /api/archives - 创建新档案记录（需认证 + review 权限） */
router.post('/', auth_1.authenticate, (0, authorize_1.authorize)('review'), archiveController_1.createArchive);
/** POST /api/archives/import - Excel 批量导入（需认证 + import 权限） */
router.post('/import', auth_1.authenticate, (0, authorize_1.authorize)('import'), upload.single('file'), archiveController_1.importArchives);
/** POST /api/archives/batch-transition - 批量状态流转（需认证，角色校验由状态机内部完成） */
router.post('/batch-transition', auth_1.authenticate, archiveController_1.batchTransitionArchive);
/** GET /api/archives/template - 下载导入模板（需认证，任意角色可下载） */
router.get('/template', auth_1.authenticate, archiveController_1.downloadTemplate);
/** GET /api/archives/:id - 获取档案详情（需认证，含状态变更历史） */
router.get('/:id', auth_1.authenticate, archiveController_1.getArchiveDetail);
/** POST /api/archives/:id/transition - 单条状态流转（需认证，角色校验由状态机内部完成） */
router.post('/:id/transition', auth_1.authenticate, archiveController_1.transitionArchive);
/** PUT /api/archives/:id - 编辑档案基础信息（需认证 + review 权限） */
router.put('/:id', auth_1.authenticate, (0, authorize_1.authorize)('review'), archiveController_1.editArchive);
exports.default = router;
//# sourceMappingURL=archive.js.map