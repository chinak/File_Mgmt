/**
 * SQLite 数据库连接模块
 * 使用 better-sqlite3 管理数据库连接
 * 数据库文件路径: backend/data/archive.db
 * 启用 WAL 模式和外键约束
 */
import Database from 'better-sqlite3';
/**
 * 获取数据库连接实例（单例模式）
 * 首次调用时创建数据库文件、启用 WAL 模式和外键约束，并执行表结构初始化
 * @param dbPath 可选的数据库文件路径，默认为 backend/data/archive.db
 * @returns better-sqlite3 数据库实例
 */
export declare function getDatabase(dbPath?: string): Database.Database;
/**
 * 关闭数据库连接并清除单例引用
 * 用于测试清理或应用关闭时调用
 */
export declare function closeDatabase(): void;
/**
 * 创建独立的数据库连接（非单例）
 * 用于测试场景，支持内存数据库
 * @param dbPath 数据库文件路径，传入 ':memory:' 使用内存数据库
 * @returns better-sqlite3 数据库实例
 */
export declare function createDatabase(dbPath: string): Database.Database;
//# sourceMappingURL=database.d.ts.map