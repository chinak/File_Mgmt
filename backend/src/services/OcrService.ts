/**
 * OCR 服务适配层
 * 定义 OCR 引擎接口和字段提取器接口，提供默认 Mock 实现
 * 需求: 10.4
 */

import type { OcrResponse } from '../../shared/types';

// -------------------- OCR 引擎原始结果 --------------------

/** OCR 引擎原始识别结果 */
export interface OcrRawResult {
  /** 识别出的原始文本 */
  text: string;
  /** 整体识别置信度 0-1 */
  confidence: number;
}

// -------------------- 接口定义 --------------------

/** OCR 引擎适配器接口，支持替换不同 OCR 实现 */
export interface IOcrEngine {
  recognize(fileBuffer: Buffer, fileType: string): Promise<OcrRawResult>;
}

/** OCR 结果解析器接口：从原始文本中提取结构化字段 */
export interface IOcrFieldExtractor {
  extract(rawResult: OcrRawResult): OcrResponse;
}

// -------------------- 默认 Mock OCR 引擎 --------------------

/**
 * 默认 OCR 引擎（Mock 实现）
 * 模拟 OCR 识别过程，返回固定格式的原始文本
 * 实际生产环境中可替换为真实 OCR 服务（如百度 OCR、腾讯 OCR 等）
 */
export class MockOcrEngine implements IOcrEngine {
  async recognize(fileBuffer: Buffer, fileType: string): Promise<OcrRawResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('扫描件识别失败，请检查文件清晰度后重试');
    }

    // Mock：返回模拟的原始识别文本
    return {
      text: [
        '客户姓名: 张三',
        '资金账号: 6000012345',
        '营业部: 北京朝阳营业部',
        '合同类型: 证券开户合同',
        '开户日期: 2024-01-15',
        '合同版本类型: 纸质版',
      ].join('\n'),
      confidence: 0.85,
    };
  }
}

// -------------------- 默认字段提取器 --------------------

/** 低置信度阈值 */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** 字段提取正则表达式映射 */
const FIELD_PATTERNS: Record<keyof OcrResponse['fields'], RegExp> = {
  customerName: /客户姓名[:：]\s*(.+)/,
  fundAccount: /资金账号[:：]\s*(.+)/,
  branchName: /营业部[:：]\s*(.+)/,
  contractType: /合同类型[:：]\s*(.+)/,
  openDate: /开户日期[:：]\s*(.+)/,
  contractVersionType: /合同版本类型[:：]\s*(.+)/,
};

/**
 * 默认字段提取器
 * 从 OCR 原始文本中通过正则匹配解析各字段及置信度
 */
export class DefaultOcrFieldExtractor implements IOcrFieldExtractor {
  extract(rawResult: OcrRawResult): OcrResponse {
    const { text, confidence: baseConfidence } = rawResult;
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    const fields = {} as OcrResponse['fields'];
    const fieldNames = Object.keys(FIELD_PATTERNS) as Array<keyof OcrResponse['fields']>;

    for (const fieldName of fieldNames) {
      const pattern = FIELD_PATTERNS[fieldName];
      let matched = false;

      for (const line of lines) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          // 字段置信度 = 基础置信度 * 字段匹配质量因子
          const fieldConfidence = this.calculateFieldConfidence(value, fieldName, baseConfidence);
          fields[fieldName] = { value, confidence: fieldConfidence };
          matched = true;
          break;
        }
      }

      if (!matched) {
        // 未匹配到的字段，置信度设为 0
        fields[fieldName] = { value: '', confidence: 0 };
      }
    }

    return {
      success: true,
      fields,
      rawText: text,
    };
  }

  /**
   * 计算单个字段的置信度
   * 基于基础置信度和字段值的合理性进行调整
   */
  private calculateFieldConfidence(
    value: string,
    fieldName: keyof OcrResponse['fields'],
    baseConfidence: number,
  ): number {
    if (!value) return 0;

    let factor = 1.0;

    switch (fieldName) {
      case 'fundAccount':
        // 资金账号应为纯数字
        factor = /^\d+$/.test(value) ? 1.0 : 0.6;
        break;
      case 'openDate':
        // 开户日期应符合 YYYY-MM-DD 格式
        factor = /^\d{4}-\d{2}-\d{2}$/.test(value) ? 1.0 : 0.5;
        break;
      case 'contractVersionType':
        // 合同版本类型应为"电子版"或"纸质版"
        factor = ['电子版', '纸质版'].includes(value) ? 1.0 : 0.4;
        break;
      default:
        // 其他字段：值越长越可能是完整识别
        factor = value.length >= 2 ? 1.0 : 0.7;
        break;
    }

    return Math.round(baseConfidence * factor * 100) / 100;
  }
}

// -------------------- OCR 服务组合类 --------------------

/**
 * OCR 服务
 * 组合 OCR 引擎和字段提取器，提供完整的识别流程
 */
export class OcrService {
  private engine: IOcrEngine;
  private extractor: IOcrFieldExtractor;

  constructor(engine?: IOcrEngine, extractor?: IOcrFieldExtractor) {
    this.engine = engine || new MockOcrEngine();
    this.extractor = extractor || new DefaultOcrFieldExtractor();
  }

  /**
   * 识别扫描件并提取结构化字段
   * @param fileBuffer 文件内容
   * @param fileType 文件类型（jpg/png/pdf）
   * @returns OCR 识别结果
   */
  async recognize(fileBuffer: Buffer, fileType: string): Promise<OcrResponse> {
    try {
      const rawResult = await this.engine.recognize(fileBuffer, fileType);
      return this.extractor.extract(rawResult);
    } catch (error) {
      return {
        success: false,
        fields: {
          customerName: { value: '', confidence: 0 },
          fundAccount: { value: '', confidence: 0 },
          branchName: { value: '', confidence: 0 },
          contractType: { value: '', confidence: 0 },
          openDate: { value: '', confidence: 0 },
          contractVersionType: { value: '', confidence: 0 },
        },
        rawText: undefined,
      };
    }
  }
}
