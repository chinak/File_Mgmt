/**
 * OCR 服务适配层
 * 定义 OCR 引擎接口和字段提取器接口，提供默认 Mock 实现
 * 需求: 10.4
 */
import type { OcrResponse } from '../../shared/types';
/** OCR 引擎原始识别结果 */
export interface OcrRawResult {
    /** 识别出的原始文本 */
    text: string;
    /** 整体识别置信度 0-1 */
    confidence: number;
}
/** OCR 引擎适配器接口，支持替换不同 OCR 实现 */
export interface IOcrEngine {
    recognize(fileBuffer: Buffer, fileType: string): Promise<OcrRawResult>;
}
/** OCR 结果解析器接口：从原始文本中提取结构化字段 */
export interface IOcrFieldExtractor {
    extract(rawResult: OcrRawResult): OcrResponse;
}
/**
 * 默认 OCR 引擎（Mock 实现）
 * 模拟 OCR 识别过程，返回固定格式的原始文本
 * 实际生产环境中可替换为真实 OCR 服务（如百度 OCR、腾讯 OCR 等）
 */
export declare class MockOcrEngine implements IOcrEngine {
    recognize(fileBuffer: Buffer, fileType: string): Promise<OcrRawResult>;
}
/**
 * 默认字段提取器
 * 从 OCR 原始文本中通过正则匹配解析各字段及置信度
 */
export declare class DefaultOcrFieldExtractor implements IOcrFieldExtractor {
    extract(rawResult: OcrRawResult): OcrResponse;
    /**
     * 计算单个字段的置信度
     * 基于基础置信度和字段值的合理性进行调整
     */
    private calculateFieldConfidence;
}
/**
 * OCR 服务
 * 组合 OCR 引擎和字段提取器，提供完整的识别流程
 */
export declare class OcrService {
    private engine;
    private extractor;
    constructor(engine?: IOcrEngine, extractor?: IOcrFieldExtractor);
    /**
     * 识别扫描件并提取结构化字段
     * @param fileBuffer 文件内容
     * @param fileType 文件类型（jpg/png/pdf）
     * @returns OCR 识别结果
     */
    recognize(fileBuffer: Buffer, fileType: string): Promise<OcrResponse>;
}
//# sourceMappingURL=OcrService.d.ts.map