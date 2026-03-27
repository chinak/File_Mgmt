/**
 * Excel 导入服务
 * 解析 Excel 文件，逐行校验必填字段和值域，创建档案记录
 * 支持资金账号唯一性校验（数据库查重 + 文件内查重）
 */
import type { ImportResponse } from '../../shared/types';
import { ArchiveRepository } from '../models/ArchiveRepository';
export declare class ImportService {
    private archiveRepo;
    constructor(archiveRepo: ArchiveRepository);
    /**
     * 解析并导入 Excel 文件
     * @param buffer Excel 文件内容
     * @returns 导入结果（总行数、成功数、失败数、错误详情）
     */
    importFromBuffer(buffer: Buffer): ImportResponse;
}
//# sourceMappingURL=ImportService.d.ts.map