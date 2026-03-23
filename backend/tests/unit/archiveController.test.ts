/**
 * 档案控制器单元测试
 * 验证导入 API 文件格式校验和模板下载功能
 */
import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { importArchives, downloadTemplate, createArchive } from '../../src/controllers/archiveController';
import type { Request, Response } from 'express';

/** 创建模拟 Response 对象 */
function createMockRes(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis() as any,
    json: vi.fn().mockReturnThis() as any,
    setHeader: vi.fn().mockReturnThis() as any,
    send: vi.fn().mockReturnThis() as any,
  };
  return res as Response;
}

describe('archiveController', () => {
  describe('importArchives - 文件格式校验', () => {
    it('未上传文件时应返回 400 错误', () => {
      const req = { file: undefined } as Request;
      const res = createMockRes();

      importArchives(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '文件格式不正确，请上传 Excel 文件' })
      );
    });

    it('上传非 Excel 文件应返回 400 错误', () => {
      const req = {
        file: {
          originalname: 'test.csv',
          buffer: Buffer.from('test'),
          mimetype: 'text/csv',
        },
      } as unknown as Request;
      const res = createMockRes();

      importArchives(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '文件格式不正确，请上传 Excel 文件' })
      );
    });

    it('上传 .txt 文件应返回 400 错误', () => {
      const req = {
        file: {
          originalname: 'data.txt',
          buffer: Buffer.from('hello'),
          mimetype: 'text/plain',
        },
      } as unknown as Request;
      const res = createMockRes();

      importArchives(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '文件格式不正确，请上传 Excel 文件' })
      );
    });

    it('上传 .pdf 文件应返回 400 错误', () => {
      const req = {
        file: {
          originalname: 'report.pdf',
          buffer: Buffer.from('pdf content'),
          mimetype: 'application/pdf',
        },
      } as unknown as Request;
      const res = createMockRes();

      importArchives(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '文件格式不正确，请上传 Excel 文件' })
      );
    });
  });

  describe('downloadTemplate', () => {
    it('应返回 Excel 文件流并设置正确的响应头', () => {
      const req = {} as Request;
      const res = createMockRes();

      downloadTemplate(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=archive_import_template.xlsx'
      );
      expect(res.send).toHaveBeenCalled();
    });

    it('模板应包含标准列头', () => {
      const req = {} as Request;
      const res = createMockRes();
      let sentBuffer: Buffer | null = null;
      (res.send as any) = vi.fn((buf: Buffer) => { sentBuffer = buf; return res; });

      downloadTemplate(req, res);

      expect(sentBuffer).not.toBeNull();
      // 解析返回的 Excel 文件，验证列头
      const wb = XLSX.read(sentBuffer!, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

      expect(data[0]).toEqual(['客户姓名', '资金账号', '营业部', '合同类型', '开户日期', '合同版本类型']);
    });

    it('模板应只有表头行，无数据行', () => {
      const req = {} as Request;
      const res = createMockRes();
      let sentBuffer: Buffer | null = null;
      (res.send as any) = vi.fn((buf: Buffer) => { sentBuffer = buf; return res; });

      downloadTemplate(req, res);

      const wb = XLSX.read(sentBuffer!, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

      // 只有一行（表头）
      expect(data).toHaveLength(1);
    });
  });

  describe('createArchive - 创建新档案记录', () => {
    it('缺少必填字段时应返回 400 错误', () => {
      const req = {
        user: { id: 'user1', username: 'operator1', role: 'operator' },
        body: {
          customerName: '张三',
          fundAccount: '12345',
          // 缺少其他必填字段
        },
      } as unknown as Request;
      const res = createMockRes();

      createArchive(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '缺少必填字段' })
      );
    });

    it('合同版本类型无效时应返回 400 错误', () => {
      const req = {
        user: { id: 'user1', username: 'operator1', role: 'operator' },
        body: {
          customerName: '张三',
          fundAccount: '12345',
          branchName: '北京分行',
          contractType: '标准合同',
          openDate: '2024-01-01',
          contractVersionType: 'invalid',
        },
      } as unknown as Request;
      const res = createMockRes();

      createArchive(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '合同版本类型无效' })
      );
    });
  });
});
