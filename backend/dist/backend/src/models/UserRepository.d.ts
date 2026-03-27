/**
 * 用户数据访问层
 * 提供用户查询功能
 */
import Database from 'better-sqlite3';
import type { User } from '../../shared/types';
export declare class UserRepository {
    private db;
    constructor(db: Database.Database);
    /** 根据用户名查询用户 */
    findByUsername(username: string): User | null;
    /** 根据 ID 查询用户 */
    findById(id: string): User | null;
}
//# sourceMappingURL=UserRepository.d.ts.map