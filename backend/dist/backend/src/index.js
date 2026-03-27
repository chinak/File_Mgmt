"use strict";
/**
 * 档案管理系统后端入口
 * 初始化 Express 应用、数据库、种子用户，注册路由
 * 生产环境下同时托管前端静态文件
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const seedUsers_1 = require("./utils/seedUsers");
const auth_1 = __importDefault(require("./routes/auth"));
const archive_1 = __importDefault(require("./routes/archive"));
const ocr_1 = __importDefault(require("./routes/ocr"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// 初始化数据库并插入种子用户，完成后再启动服务
const db = (0, database_1.getDatabase)();
(0, seedUsers_1.seedUsers)(db).then(() => {
    // 注册 API 路由
    app.use('/api/auth', auth_1.default);
    app.use('/api/archives', archive_1.default);
    app.use('/api/ocr', ocr_1.default);
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok' });
    });
    // 生产环境：托管前端静态文件，支持 SPA 路由 fallback
    if (isProduction) {
        const frontendDist = path_1.default.join(__dirname, '../../frontend/dist');
        app.use(express_1.default.static(frontendDist));
        app.get('*', (_req, res) => {
            res.sendFile(path_1.default.join(frontendDist, 'index.html'));
        });
    }
    app.listen(PORT, () => {
        console.log(`档案管理系统后端服务已启动，端口: ${PORT}`);
        if (isProduction) {
            console.log('生产模式：前端静态文件由 Express 托管');
        }
        console.log('测试账号（密码均为 123456）：operator / branch / general');
    });
});
exports.default = app;
//# sourceMappingURL=index.js.map