"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedUsers = seedUsers;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const SEED_USERS = [
    { username: 'operator', password: '123456', role: 'operator', branchName: null },
    { username: 'branch', password: '123456', role: 'branch', branchName: '上海营业部' },
    { username: 'general', password: '123456', role: 'general_affairs', branchName: null },
];
async function seedUsers(db) {
    const insert = db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, branch_name) VALUES (?, ?, ?, ?, ?)');
    for (const u of SEED_USERS) {
        const hash = await bcryptjs_1.default.hash(u.password, 10);
        insert.run((0, uuid_1.v4)(), u.username, hash, u.role, u.branchName);
    }
}
//# sourceMappingURL=seedUsers.js.map