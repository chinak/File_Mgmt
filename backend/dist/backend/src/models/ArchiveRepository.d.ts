/**
 * 档案记录数据访问层
 * 提供档案记录的 CRUD 操作和分页查询功能
 */
import Database from 'better-sqlite3';
import type { ArchiveRecord, ArchiveQueryParams, ContractVersionType, MainStatus, ArchiveSubStatus } from '../../shared/types';
/** 创建档案记录的输入参数 */
export interface CreateArchiveInput {
    customerName: string;
    fundAccount: string;
    branchName: string;
    contractType: string;
    openDate: string;
    contractVersionType: ContractVersionType;
    status: MainStatus | 'completed' | null;
    archiveStatus: ArchiveSubStatus;
}
/** 更新档案记录的输入参数（部分更新） */
export interface UpdateArchiveInput {
    status?: MainStatus | 'completed' | null;
    archiveStatus?: ArchiveSubStatus;
    scanFileUrl?: string;
}
/** 编辑档案基础信息的输入参数 */
export interface EditArchiveInput {
    customerName?: string;
    fundAccount?: string;
    branchName?: string;
    contractType?: string;
    openDate?: string;
    contractVersionType?: ContractVersionType;
}
/** 分页查询结果 */
export interface PaginatedResult {
    total: number;
    records: ArchiveRecord[];
}
export declare class ArchiveRepository {
    private db;
    constructor(db: Database.Database);
    /** 创建档案记录 */
    create(input: CreateArchiveInput): ArchiveRecord;
    /** 根据 ID 查询档案记录 */
    findById(id: string): ArchiveRecord | null;
    /** 根据资金账号查询档案记录 */
    findByFundAccount(fundAccount: string): ArchiveRecord | null;
    /** 更新档案记录 */
    update(id: string, input: UpdateArchiveInput): ArchiveRecord | null;
    /** 编辑档案基础信息 */
    editBasicInfo(id: string, input: EditArchiveInput): ArchiveRecord | null;
    /**
     * 分页查询档案记录
     * 支持多条件组合查询：客户姓名模糊匹配、资金账号精确匹配、
     * 营业部、合同类型、主流程状态、综合部归档状态、
     * 合同版本类型、开户日期范围
     */
    queryWithPagination(params: ArchiveQueryParams): PaginatedResult;
}
//# sourceMappingURL=ArchiveRepository.d.ts.map