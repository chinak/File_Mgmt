"use strict";
/**
 * 用户数据访问层
 * 提供用户查询功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
/** 将数据库行转换为 User 接口 */
function rowToUser(row) {
    return {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        role: row.role,
        branchName: row.branch_name ?? undefined,
        createdAt: row.created_at,
    };
}
class UserRepository {
    constructor(db) {
        this.db = db;
    }
    /** 根据用户名查询用户 */
    findByUsername(username) {
        const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        return row ? rowToUser(row) : null;
    }
    /** 根据 ID 查询用户 */
    findById(id) {
        const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        return row ? rowToUser(row) : null;
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=UserRepository.js.map