/**
 * 认证路由
 * 注册登录和获取当前用户信息的路由
 */

import { Router } from 'express';
import { login, me } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const router = Router();

/** POST /api/auth/login - 用户登录 */
router.post('/login', login);

/** GET /api/auth/me - 获取当前用户信息（需认证） */
router.get('/me', authenticate, me);

export default router;
