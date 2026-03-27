"use strict";
/**
 * SQLite 数据库连接模块
 * 使用 better-sqlite3 管理数据库连接
 * 数据库文件路径: backend/data/archive.db
 * 启用 WAL 模式和外键约束
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
exports.createDatabase = createDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_init_1 = require("./database-init");
/** 数据库文件默认路径 */
const DEFAULT_DB_PATH = path_1.default.resolve(__dirname, '..', 'data', 'archive.db');
/** 数据库单例实例 */
let dbInstance = null;
/**
 * 获取数据库连接实例（单例模式）
 * 首次调用时创建数据库文件、启用 WAL 模式和外键约束，并执行表结构初始化
 * @param dbPath 可选的数据库文件路径，默认为 backend/data/archive.db
 * @returns better-sqlite3 数据库实例
 */
function getDatabase(dbPath) {
    if (dbInstance) {
        return dbInstance;
    }
    const resolvedPath = dbPath || DEFAULT_DB_PATH;
    // 确保数据库目录存在
    const dir = path_1.default.dirname(resolvedPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    // 创建数据库连接
    const db = new better_sqlite3_1.default(resolvedPath);
    // 启用 WAL 模式，提升并发读写性能
    db.pragma('journal_mode = WAL');
    // 启用外键约束
    db.pragma('foreign_keys = ON');
    // 执行表结构初始化
    db.exec(database_init_1.INIT_SQL);
    dbInstance = db;
    return db;
}
/**
 * 关闭数据库连接并清除单例引用
 * 用于测试清理或应用关闭时调用
 */
function closeDatabase() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
/**
 * 创建独立的数据库连接（非单例）
 * 用于测试场景，支持内存数据库
 * @param dbPath 数据库文件路径，传入 ':memory:' 使用内存数据库
 * @returns better-sqlite3 数据库实例
 */
function createDatabase(dbPath) {
    const db = new better_sqlite3_1.default(dbPath);
    // 启用 WAL 模式（内存数据库不需要，但不会报错）
    if (dbPath !== ':memory:') {
        db.pragma('journal_mode = WAL');
    }
    // 启用外键约束
    db.pragma('foreign_keys = ON');
    // 执行表结构初始化
    db.exec(database_init_1.INIT_SQL);
    return db;
}
//# sourceMappingURL=database.js.map