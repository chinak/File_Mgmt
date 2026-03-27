/**
 * OCR 控制器
 * 处理扫描件上传与 OCR 识别请求
 * 需求: 10.2, 10.3, 10.8, 10.9
 */
import { Request, Response } from 'express';
/**
 * POST /api/ocr/recognize
 * 接收扫描件文件上传，校验格式和大小，调用 OCR 引擎返回结构化识别结果
 */
export declare function recognizeFile(req: Request, res: Response): void;
//# sourceMappingURL=ocrController.d.ts.map