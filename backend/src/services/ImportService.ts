/**
 * Excel 导入服务
 * 解析 Excel 文件，逐行校验必填字段和值域，创建档案记录
 * 支持资金账号唯一性校验（数据库查重 + 文件内查重）
 */

import * as XLSX from 'xlsx';
import type {
  ImportResponse,
  ContractVersionType,
  MainStatus,
  ArchiveSubStatus,
} from '../../shared/types';
import { ArchiveRepository, CreateArchiveInput } from '../models/ArchiveRepository';

/** Excel 列名到字段名的映射 */
const COLUMN_MAP: Record<string, string> = {
  '客户姓名': 'customerName',
  '资金账号': 'fundAccount',
  '营业部': 'branchName',
  '合同类型': 'contractType',
  '开户日期': 'openDate',
  '合同版本类型': 'contractVersionType',
};

/** 必填字段列表（Excel 列名） */
const REQUIRED_COLUMNS = ['客户姓名', '资金账号', '营业部', '合同类型', '开户日期', '合同版本类型'];

/** 合同版本类型中文到英文的映射 */
const VERSION_TYPE_MAP: Record<string, ContractVersionType> = {
  '电子版': 'electronic',
  '纸质版': 'paper',
};

/** Excel 行数据接口 */
interface ExcelRow {
  [key: string]: unknown;
}

export class ImportService {
  private archiveRepo: ArchiveRepository;

  constructor(archiveRepo: ArchiveRepository) {
    this.archiveRepo = archiveRepo;
  }

  /**
   * 解析并导入 Excel 文件
   * @param buffer Excel 文件内容
   * @returns 导入结果（总行数、成功数、失败数、错误详情）
   */
  importFromBuffer(buffer: Buffer): ImportResponse {
    // 解析 Excel 文件
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { totalRows: 0, successCount: 0, failureCount: 0, errors: [] };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

    const totalRows = rows.length;
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    // 文件内资金账号查重集合
    const seenFundAccounts = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // Excel 行号（第1行为表头，数据从第2行开始）
      const row = rows[i];

      // 1. 校验必填字段
      const missingFields = REQUIRED_COLUMNS.filter(col => {
        const value = row[col];
        return value === undefined || value === null || String(value).trim() === '';
      });

      if (missingFields.length > 0) {
        errors.push({ row: rowNumber, reason: `缺少必填字段: ${missingFields.join(', ')}` });
        failureCount++;
        continue;
      }

      // 2. 校验合同版本类型值域
      const versionTypeRaw = String(row['合同版本类型']).trim();
      const contractVersionType = VERSION_TYPE_MAP[versionTypeRaw];
      if (!contractVersionType) {
        errors.push({ row: rowNumber, reason: '合同版本类型不合法' });
        failureCount++;
        continue;
      }

      // 3. 校验资金账号唯一性 - 文件内查重
      const fundAccount = String(row['资金账号']).trim();
      if (seenFundAccounts.has(fundAccount)) {
        errors.push({ row: rowNumber, reason: `资金账号 ${fundAccount} 在文件中重复` });
        failureCount++;
        continue;
      }

      // 4. 校验资金账号唯一性 - 数据库查重
      const existing = this.archiveRepo.findByFundAccount(fundAccount);
      if (existing) {
        errors.push({ row: rowNumber, reason: `资金账号 ${fundAccount} 已存在` });
        failureCount++;
        continue;
      }

      // 5. 根据合同版本类型设置初始状态
      let status: MainStatus | null;
      let archiveStatus: ArchiveSubStatus;

      if (contractVersionType === 'paper') {
        // 纸质版：进入完整业务流程
        status = 'pending_shipment';
        archiveStatus = 'archive_not_started';
      } else {
        // 电子版：直接完结
        status = null;
        archiveStatus = 'archived';
      }

      // 6. 创建档案记录
      const input: CreateArchiveInput = {
        customerName: String(row['客户姓名']).trim(),
        fundAccount,
        branchName: String(row['营业部']).trim(),
        contractType: String(row['合同类型']).trim(),
        openDate: String(row['开户日期']).trim(),
        contractVersionType,
        status,
        archiveStatus,
      };

      this.archiveRepo.create(input);
      seenFundAccounts.add(fundAccount);
      successCount++;
    }

    return { totalRows, successCount, failureCount, errors };
  }
}
