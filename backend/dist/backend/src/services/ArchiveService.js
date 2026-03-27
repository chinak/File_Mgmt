"use strict";
/**
 * 档案查询服务
 * 处理档案记录的查询逻辑，包括分支机构数据隔离和分页
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveService = void 0;
/** 默认每页记录数 */
const DEFAULT_PAGE_SIZE = 20;
/** 默认页码 */
const DEFAULT_PAGE = 1;
class ArchiveService {
    constructor(archiveRepo) {
        this.archiveRepo = archiveRepo;
    }
    /**
     * 查询档案记录
     * 分支机构用户自动过滤为本营业部数据
     * @param params 查询参数
     * @param userRole 当前用户角色
     * @param branchName 当前用户所属营业部（分支机构用户必填）
     */
    query(params, userRole, branchName) {
        // 构建完整查询参数，设置分页默认值
        const page = params.page && params.page > 0 ? params.page : DEFAULT_PAGE;
        const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : DEFAULT_PAGE_SIZE;
        const queryParams = {
            customerName: params.customerName,
            fundAccount: params.fundAccount,
            branchName: params.branchName,
            contractType: params.contractType,
            status: params.status,
            archiveStatus: params.archiveStatus,
            contractVersionType: params.contractVersionType,
            openDateStart: params.openDateStart,
            openDateEnd: params.openDateEnd,
            page,
            pageSize,
        };
        // 分支机构用户强制过滤为本营业部数据
        if (userRole === 'branch' && branchName) {
            queryParams.branchName = branchName;
        }
        const result = this.archiveRepo.queryWithPagination(queryParams);
        return {
            total: result.total,
            page,
            pageSize,
            records: result.records,
        };
    }
}
exports.ArchiveService = ArchiveService;
//# sourceMappingURL=ArchiveService.js.map