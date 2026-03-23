/**
 * 档案管理系统后端入口
 * 初始化 Express 应用、数据库、种子用户，注册路由
 */

import express from 'express';
import cors from 'cors';
import { getDatabase } from './database';
import { seedUsers } from './utils/seedUsers';
import authRouter from './routes/auth';
import archiveRouter from './routes/archive';
import ocrRouter from './routes/ocr';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 初始化数据库并插入种子用户，完成后再启动服务
const db = getDatabase();
seedUsers(db).then(() => {
  // 注册路由
  app.use('/api/auth', authRouter);
  app.use('/api/archives', archiveRouter);
  app.use('/api/ocr', ocrRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.listen(PORT, () => {
    console.log(`档案管理系统后端服务已启动，端口: ${PORT}`);
    console.log('测试账号（密码均为 123456）：operator / branch / general');
  });
});

export default app;
