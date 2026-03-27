/**
 * 档案管理系统后端入口
 * 初始化 Express 应用、数据库、种子用户，注册路由
 * 生产环境下同时托管前端静态文件
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { getDatabase } from './database';
import { seedUsers } from './utils/seedUsers';
import authRouter from './routes/auth';
import archiveRouter from './routes/archive';
import ocrRouter from './routes/ocr';

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// 初始化数据库并插入种子用户，完成后再启动服务
const db = getDatabase();
seedUsers(db).then(() => {
  // 注册 API 路由
  app.use('/api/auth', authRouter);
  app.use('/api/archives', archiveRouter);
  app.use('/api/ocr', ocrRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // 生产环境：托管前端静态文件，支持 SPA 路由 fallback
  if (isProduction) {
    const frontendDist = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
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

export default app;
