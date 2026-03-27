# ============================================
# 档案管理系统 Docker 多阶段构建
# 阶段1: 构建前端静态文件
# 阶段2: 构建后端 TypeScript
# 阶段3: 生产运行镜像
# ============================================

# --- 阶段1: 构建前端 ---
FROM node:20-alpine AS frontend-build
WORKDIR /app

# 复制 shared 类型（前端依赖）
COPY shared/ ./shared/

# 安装前端依赖并构建
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# --- 阶段2: 构建后端 ---
FROM node:20-alpine AS backend-build
WORKDIR /app

# 复制 shared 类型（后端依赖）
COPY shared/ ./shared/

# 安装后端依赖并编译 TypeScript
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci
COPY backend/ ./backend/
RUN cd backend && npm run build

# --- 阶段3: 生产运行 ---
FROM node:20-alpine AS production
WORKDIR /app

# better-sqlite3 需要的原生编译依赖
RUN apk add --no-cache python3 make g++

# 只安装生产依赖
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev && apk del python3 make g++

# 复制编译后的后端代码
COPY --from=backend-build /app/backend/dist/ ./backend/dist/
COPY --from=backend-build /app/shared/ ./shared/

# 复制前端构建产物
COPY --from=frontend-build /app/frontend/dist/ ./frontend/dist/

# 创建数据目录（SQLite 数据库存放位置）
RUN mkdir -p /app/backend/data

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# 启动后端服务（同时托管前端静态文件）
CMD ["node", "backend/dist/backend/src/index.js"]
