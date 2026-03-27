"use strict";
/**
 * OCR 路由
 * 注册 OCR 识别相关路由
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middlewares/auth");
const authorize_1 = require("../middlewares/authorize");
const ocrController_1 = require("../controllers/ocrController");
const router = (0, express_1.Router)();
/** 配置 multer 使用内存存储 */
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
/** POST /api/ocr/recognize - 上传扫描件并 OCR 识别（需认证 + ocr 权限） */
router.post('/recognize', auth_1.authenticate, (0, authorize_1.authorize)('ocr'), upload.single('file'), ocrController_1.recognizeFile);
exports.default = router;
//# sourceMappingURL=ocr.js.map