"use strict";
/**
 * 档案记录数据访问层
 * 提供档案记录的 CRUD 操作和分页查询功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveRepository = void 0;
const uuid_1 = require("uuid");
/** 将数据库行转换为 ArchiveRecord 接口 */
function rowToRecord(row) {
    return {
        id: row.id,
        customerName: row.customer_name,
        fundAccount: row.fund_account,
        branchName: row.branch_name,
        contractType: row.contract_type,
        openDate: row.open_date,
        contractVersionType: row.contract_version_type,
        status: row.status,
        archiveStatus: row.archive_status,
        scanFileUrl: row.scan_file_url ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
class ArchiveRepository {
    constructor(db) {
        this.db = db;
    }
    /** 创建档案记录 */
    create(input) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const stmt = this.db.prepare(`
      INSERT INTO archive_records (
        id, customer_name, fund_account, branch_name, contract_type,
        open_date, contract_version_type, status,
        archive_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, input.customerName, input.fundAccount, input.branchName, input.contractType, input.openDate, input.contractVersionType, input.status, input.archiveStatus, now, now);
        return this.findById(id);
    }
    /** 根据 ID 查询档案记录 */
    findById(id) {
        const row = this.db.prepare('SELECT * FROM archive_records WHERE id = ?').get(id);
        return row ? rowToRecord(row) : null;
    }
    /** 根据资金账号查询档案记录 */
    findByFundAccount(fundAccount) {
        const row = this.db.prepare('SELECT * FROM archive_records WHERE fund_account = ?').get(fundAccount);
        return row ? rowToRecord(row) : null;
    }
    /** 更新档案记录 */
    update(id, input) {
        const setClauses = [];
        const params = [];
        if (input.status !== undefined) {
            setClauses.push('status = ?');
            params.push(input.status);
        }
        if (input.archiveStatus !== undefined) {
            setClauses.push('archive_status = ?');
            params.push(input.archiveStatus);
        }
        if (input.scanFileUrl !== undefined) {
            setClauses.push('scan_file_url = ?');
            params.push(input.scanFileUrl);
        }
        if (setClauses.length === 0) {
            return this.findById(id);
        }
        // 更新 updated_at 时间戳
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        setClauses.push('updated_at = ?');
        params.push(now);
        params.push(id);
        this.db.prepare(`UPDATE archive_records SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
        return this.findById(id);
    }
    /** 编辑档案基础信息 */
    editBasicInfo(id, input) {
        const setClauses = [];
        const params = [];
        if (input.customerName !== undefined) {
            setClauses.push('customer_name = ?');
            params.push(input.customerName);
        }
        if (input.fundAccount !== undefined) {
            setClauses.push('fund_account = ?');
            params.push(input.fundAccount);
        }
        if (input.branchName !== undefined) {
            setClauses.push('branch_name = ?');
            params.push(input.branchName);
        }
        if (input.contractType !== undefined) {
            setClauses.push('contract_type = ?');
            params.push(input.contractType);
        }
        if (input.openDate !== undefined) {
            setClauses.push('open_date = ?');
            params.push(input.openDate);
        }
        if (input.contractVersionType !== undefined) {
            setClauses.push('contract_version_type = ?');
            params.push(input.contractVersionType);
        }
        if (setClauses.length === 0) {
            return this.findById(id);
        }
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        setClauses.push('updated_at = ?');
        params.push(now);
        params.push(id);
        this.db.prepare(`UPDATE archive_records SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
        return this.findById(id);
    }
    /**
     * 分页查询档案记录
     * 支持多条件组合查询：客户姓名模糊匹配、资金账号精确匹配、
     * 营业部、合同类型、主流程状态、综合部归档状态、
     * 合同版本类型、开户日期范围
     */
    queryWithPagination(params) {
        const conditions = [];
        const queryParams = [];
        // 客户姓名模糊匹配
        if (params.customerName) {
            conditions.push('customer_name LIKE ?');
            queryParams.push(`%${params.customerName}%`);
        }
        // 资金账号精确匹配
        if (params.fundAccount) {
            conditions.push('fund_account = ?');
            queryParams.push(params.fundAccount);
        }
        // 营业部精确匹配
        if (params.branchName) {
            conditions.push('branch_name = ?');
            queryParams.push(params.branchName);
        }
        // 合同类型精确匹配
        if (params.contractType) {
            conditions.push('contract_type = ?');
            queryParams.push(params.contractType);
        }
        // 主流程状态精确匹配
        if (params.status) {
            conditions.push('status = ?');
            queryParams.push(params.status);
        }
        // 综合部归档状态精确匹配
        if (params.archiveStatus) {
            conditions.push('archive_status = ?');
            queryParams.push(params.archiveStatus);
        }
        // 合同版本类型精确匹配
        if (params.contractVersionType) {
            conditions.push('contract_version_type = ?');
            queryParams.push(params.contractVersionType);
        }
        // 开户日期范围查询
        if (params.openDateStart) {
            conditions.push('open_date >= ?');
            queryParams.push(params.openDateStart);
        }
        if (params.openDateEnd) {
            conditions.push('open_date <= ?');
            queryParams.push(params.openDateEnd);
        }
        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';
        // 查询总数
        const countRow = this.db.prepare(`SELECT COUNT(*) as total FROM archive_records ${whereClause}`).get(...queryParams);
        const total = countRow.total;
        // 分页查询
        const offset = (params.page - 1) * params.pageSize;
        const rows = this.db.prepare(`SELECT * FROM archive_records ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...queryParams, params.pageSize, offset);
        return {
            total,
            records: rows.map(rowToRecord),
        };
    }
}
exports.ArchiveRepository = ArchiveRepository;
//# sourceMappingURL=ArchiveRepository.js.map