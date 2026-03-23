/**
 * OCR 控制器
 * 处理扫描件上传与 OCR 识别请求
 * 需求: 10.2, 10.3, 10.8, 10.9
 */

import { Request, Response } from 'express';
import { OcrService } from '../services/OcrService';

/** 允许的扫描件文件 MIME 类型 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
];

/** 允许的文件扩展名 */
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];

/** 文件大小上限（10MB） */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 校验文件扩展名是否为合法的扫描件格式
 */
function isValidScanFile(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * 从文件名中提取文件类型
 */
function getFileType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
}

/**
 * POST /api/ocr/recognize
 * 接收扫描件文件上传，校验格式和大小，调用 OCR 引擎返回结构化识别结果
 */
export function recognizeFile(req: Request, res: Response): void {
  const file = req.file;

  // 校验是否上传了文件
  if (!file) {
    res.status(400).json({
      code: 'INVALID_FILE',
      message: '文件格式不支持，请上传 JPG、PNG 或 PDF 格式的扫描件',
    });
    return;
  }

  // 校验文件格式（扩展名 + MIME 类型）
  if (!isValidScanFile(file.originalname) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    res.status(400).json({
      code: 'INVALID_FILE_FORMAT',
      message: '文件格式不支持，请上传 JPG、PNG 或 PDF 格式的扫描件',
    });
    return;
  }

  // 校验文件大小
  if (file.size > MAX_FILE_SIZE) {
    res.status(400).json({
      code: 'FILE_TOO_LARGE',
      message: '文件大小超出限制，请压缩后重新上传',
    });
    return;
  }

  const fileType = getFileType(file.originalname);
  const ocrService = new OcrService();

  ocrService.recognize(file.buffer, fileType)
    .then((result) => {
      if (!result.success) {
        res.status(500).json({
          code: 'OCR_FAILED',
          message: '扫描件识别失败，请检查文件清晰度后重试',
        });
        return;
      }
      res.json(result);
    })
    .catch(() => {
      res.status(500).json({
        code: 'OCR_FAILED',
        message: '扫描件识别失败，请检查文件清晰度后重试',
      });
    });
}
