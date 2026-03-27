"use strict";
/**
 * 认证路由
 * 注册登录和获取当前用户信息的路由
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
/** POST /api/auth/login - 用户登录 */
router.post('/login', authController_1.login);
/** GET /api/auth/me - 获取当前用户信息（需认证） */
router.get('/me', auth_1.authenticate, authController_1.me);
exports.default = router;
//# sourceMappingURL=auth.js.map