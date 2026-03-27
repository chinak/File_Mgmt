/**
 * 档案查询服务
 * 处理档案记录的查询逻辑，包括分支机构数据隔离和分页
 */
import { ArchiveRepository } from '../models/ArchiveRepository';
import type { ArchiveQueryParams, ArchiveListResponse, UserRole } from '../../shared/types';
export declare class ArchiveService {
    private archiveRepo;
    constructor(archiveRepo: ArchiveRepository);
    /**
     * 查询档案记录
     * 分支机构用户自动过滤为本营业部数据
     * @param params 查询参数
     * @param userRole 当前用户角色
     * @param branchName 当前用户所属营业部（分支机构用户必填）
     */
    query(params: Partial<ArchiveQueryParams>, userRole: UserRole, branchName?: string): ArchiveListResponse;
}
//# sourceMappingURL=ArchiveService.d.ts.map