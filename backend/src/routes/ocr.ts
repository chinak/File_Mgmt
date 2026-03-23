/**
 * OCR 路由
 * 注册 OCR 识别相关路由
 */

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { recognizeFile } from '../controllers/ocrController';

const router = Router();

/** 配置 multer 使用内存存储 */
const upload = multer({ storage: multer.memoryStorage() });

/** POST /api/ocr/recognize - 上传扫描件并 OCR 识别（需认证 + ocr 权限） */
router.post('/recognize', authenticate, authorize('ocr'), upload.single('file'), recognizeFile);

export default router;
