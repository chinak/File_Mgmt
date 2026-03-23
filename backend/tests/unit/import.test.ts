/**
 * Excel 导入服务单元测试
 * 验证 ImportService 的解析、校验、导入逻辑
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import { createDatabase } from '../../src/database';
import { ArchiveRepository } from '../../src/models/ArchiveRepository';
import { ImportService } from '../../src/services/ImportService';

function createExcelBuffer(rows: Record<string, string>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
function validPaperRow(fa: string): Record<string, string> {
  return { '客户姓名': '张三', '资金账号': fa, '营业部': '北京营业部', '合同类型': '开户合同', '开户日期': '2024-01-15', '合同版本类型': '纸质版' };
}
function validElectronicRow(fa: string): Record<string, string> {
  return { '客户姓名': '李四', '资金账号': fa, '营业部': '上海营业部', '合同类型': '理财合同', '开户日期': '2024-02-01', '合同版本类型': '电子版' };
}

describe('ImportService', () => {
  let db: Database.Database;
  let archiveRepo: ArchiveRepository;
  let svc: ImportService;
  beforeEach(() => { db = createDatabase(':memory:'); archiveRepo = new ArchiveRepository(db); svc = new ImportService(archiveRepo); });
  afterEach(() => { db.close(); });

  it('应成功导入纸质版档案记录，初始状态正确', () => {
    const r = svc.importFromBuffer(createExcelBuffer([validPaperRow('FA001')]));
    expect(r.totalRows).toBe(1); expect(r.successCount).toBe(1); expect(r.failureCount).toBe(0);
    const rec = archiveRepo.findByFundAccount('FA001')!;
    expect(rec.contractVersionType).toBe('paper');
    expect(rec.status).toBe('pending_shipment');
    expect(rec.archiveStatus).toBe('archive_not_started');
  });
  it('应成功导入电子版档案记录，状态直接完结', () => {
    const r = svc.importFromBuffer(createExcelBuffer([validElectronicRow('FA002')]));
    expect(r.successCount).toBe(1);
    const rec = archiveRepo.findByFundAccount('FA002')!;
    expect(rec.contractVersionType).toBe('electronic');
    expect(rec.status).toBeNull();
    expect(rec.archiveStatus).toBe('archived');
  });
  it('应成功导入多行数据', () => {
    const r = svc.importFromBuffer(createExcelBuffer([validPaperRow('FA010'), validElectronicRow('FA011'), validPaperRow('FA012')]));
    expect(r.totalRows).toBe(3); expect(r.successCount).toBe(3);
  });
  it('缺少客户姓名应跳过并记录错误', () => {
    const row = validPaperRow('FA020'); delete row['客户姓名'];
    const r = svc.importFromBuffer(createExcelBuffer([row]));
    expect(r.failureCount).toBe(1); expect(r.errors[0].row).toBe(2); expect(r.errors[0].reason).toContain('客户姓名');
  });
  it('缺少资金账号应跳过并记录错误', () => {
    const row = validPaperRow('FA021'); delete row['资金账号'];
    const r = svc.importFromBuffer(createExcelBuffer([row]));
    expect(r.failureCount).toBe(1); expect(r.errors[0].reason).toContain('资金账号');
  });
  it('空白字段值应视为缺失', () => {
    const row = validPaperRow('FA022'); row['营业部'] = '   ';
    const r = svc.importFromBuffer(createExcelBuffer([row]));
    expect(r.failureCount).toBe(1); expect(r.errors[0].reason).toContain('营业部');
  });
  it('缺少多个必填字段应全部列出', () => {
    const r = svc.importFromBuffer(createExcelBuffer([{ '客户姓名': '张三' } as Record<string, string>]));
    expect(r.failureCount).toBe(1); expect(r.errors[0].reason).toContain('资金账号'); expect(r.errors[0].reason).toContain('营业部');
  });
  it('非法合同版本类型应跳过并记录错误', () => {
    const row = validPaperRow('FA030'); row['合同版本类型'] = '未知类型';
    const r = svc.importFromBuffer(createExcelBuffer([row]));
    expect(r.failureCount).toBe(1); expect(r.errors[0].reason).toBe('合同版本类型不合法');
  });
  it('空的合同版本类型应视为缺失必填字段', () => {
    const row = validPaperRow('FA031'); row['合同版本类型'] = '';
    const r = svc.importFromBuffer(createExcelBuffer([row]));
    expect(r.failureCount).toBe(1);
  });
  it('文件内资金账号重复应跳过后续重复行', () => {
    const r = svc.importFromBuffer(createExcelBuffer([validPaperRow('FA040'), validPaperRow('FA040')]));
    expect(r.successCount).toBe(1); expect(r.failureCount).toBe(1);
    expect(r.errors[0].row).toBe(3); expect(r.errors[0].reason).toContain('FA040'); expect(r.errors[0].reason).toContain('重复');
  });
  it('数据库中已存在的资金账号应跳过', () => {
    archiveRepo.create({ customerName: '已有', fundAccount: 'FA041', branchName: '北京', contractType: '开户', openDate: '2024-01-01', contractVersionType: 'paper', status: 'pending_shipment', archiveStatus: 'archive_not_started' });
    const r = svc.importFromBuffer(createExcelBuffer([validPaperRow('FA041')]));
    expect(r.failureCount).toBe(1); expect(r.errors[0].reason).toContain('FA041'); expect(r.errors[0].reason).toContain('已存在');
  });
  it('合法行和非法行混合导入，应正确统计', () => {
    const bad = validPaperRow('FA050'); bad['合同版本类型'] = '无效';
    const r = svc.importFromBuffer(createExcelBuffer([validPaperRow('FA051'), bad, validElectronicRow('FA052')]));
    expect(r.totalRows).toBe(3); expect(r.successCount).toBe(2); expect(r.failureCount).toBe(1); expect(r.errors[0].row).toBe(3);
  });
  it('totalRows 应等于 successCount + failureCount', () => {
    const r = svc.importFromBuffer(createExcelBuffer([validPaperRow('FA060'), validPaperRow('FA060'), validElectronicRow('FA061'), { '客户姓名': '缺失' } as Record<string, string>]));
    expect(r.totalRows).toBe(4); expect(r.successCount + r.failureCount).toBe(r.totalRows);
  });
  it('空 Excel 文件应返回零计数', () => {
    const r = svc.importFromBuffer(createExcelBuffer([]));
    expect(r.totalRows).toBe(0); expect(r.successCount).toBe(0); expect(r.failureCount).toBe(0);
  });
  it('仅有表头无数据行的 Excel 应返回零计数', () => {
    const ws = XLSX.utils.aoa_to_sheet([['客户姓名','资金账号','营业部','合同类型','开户日期','合同版本类型']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const r = svc.importFromBuffer(Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })));
    expect(r.totalRows).toBe(0); expect(r.successCount).toBe(0);
  });
  it('错误行号应对应 Excel 实际行号', () => {
    const r2 = validPaperRow('FA071'); r2['合同版本类型'] = '非法';
    const r3 = validPaperRow('FA072'); r3['客户姓名'] = '';
    const r = svc.importFromBuffer(createExcelBuffer([validPaperRow('FA070'), r2, r3]));
    expect(r.errors).toHaveLength(2); expect(r.errors[0].row).toBe(3); expect(r.errors[1].row).toBe(4);
  });
});