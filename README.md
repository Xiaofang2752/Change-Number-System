# 自动取号系统 (Change Number System)

一个基于 React + TypeScript + Express + SQLite 的自动取号管理系统。

## 技术栈

**前端:**
- React 18 + TypeScript
- Vite
- React Router
- Axios
- Zod (验证)

**后端:**
- Node.js + Express
- better-sqlite3 (WAL 模式)
- JWT (认证)
- bcrypt (密码加密)

## 功能特性

- ✅ 用户编号申请 (自动生成流水号)
- ✅ 项目代号管理 (预设 + 用户申请)
- ✅ 编号类型管理 (预设 + 用户申请)
  - 预设类型: CR (Change Request), DCP (Design Change Proposal), CN (Change Notice), TD (Technical Document)
  - 编号格式: `{类型}-{项目代号}-{4位流水号}` (例如: `TD-ALPHA01-0001`)
- ✅ 管理员审核机制
- ✅ 申请记录管理 (搜索、过滤、分页)
- ✅ 数据导出 (CSV)
- ✅ IP 地址追踪 (仅管理员可见)
- ✅ 权限控制 (普通用户 vs 管理员)

## 安装和运行

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd frontend && npm install

# 安装后端依赖
cd backend && npm install
```

### 2. 配置环境变量

```bash
# 复制示例配置
cp backend/.env.example backend/.env

# 编辑 .env 文件,修改管理员密码等配置
```

### 3. 启动开发服务器

```bash
# 同时启动前后端 (推荐)
npm run dev

# 或分别启动
npm run dev:frontend  # 前端: http://localhost:3000
npm run dev:backend   # 后端: http://localhost:3001
```

### 4. 访问应用

- 前端: http://localhost:3000
- 后端 API: http://localhost:3001
- 管理员登录: http://localhost:3000/admin/login

## 默认管理员账号

- 用户名: `admin`
- 密码: `Aa123456` (可在 `.env` 中修改)

## API 文档

### 项目代号

- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目 (管理员)
- `PUT /api/projects/:id` - 更新项目 (管理员)
- `DELETE /api/projects/:id` - 删除项目 (管理员)
- `POST /api/projects/request` - 申请新项目
- `PUT /api/projects/:id/review` - 审核项目申请 (管理员)

### 编号类型

- `GET /api/number-types` - 获取编号类型列表
- `POST /api/number-types` - 创建编号类型 (管理员)
- `PUT /api/number-types/:id` - 更新编号类型 (管理员)
- `DELETE /api/number-types/:id` - 删除编号类型 (管理员)
- `POST /api/number-types/request` - 申请新编号类型
- `PUT /api/number-types/:id/review` - 审核编号类型申请 (管理员)

### 申请记录

- `POST /api/applications` - 提交申请
- `GET /api/applications` - 获取申请列表 (支持分页、搜索、过滤)
- `GET /api/applications/stats` - 获取统计数据
- `GET /api/applications/export` - 导出 CSV (管理员)
- `DELETE /api/applications/:id` - 删除单条申请 (管理员)
- `DELETE /api/applications` - 批量删除申请 (管理员)

### 管理员认证

- `POST /api/admin/login` - 管理员登录
- `POST /api/admin/logout` - 管理员登出

## 数据库

数据库文件存储在 `backend/data/app.db` (SQLite WAL 模式)

## 测试

```bash
# 运行后端测试
npm run test:backend

# 运行前端测试
npm run test:frontend

# 运行所有测试
npm test
```

## 部署

### Docker 部署 (推荐)

#### 使用 Docker Compose (最简单)

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，修改必要配置

# 2. 启动应用
docker-compose up -d

# 3. 访问应用
# 前端: http://localhost:3000
# 后端 API: http://localhost:3000/api

# 4. 查看日志
docker-compose logs -f

# 5. 停止应用
docker-compose down
```

#### 手动构建和运行

```bash
# 构建镜像
bash scripts/docker/build.sh

# 运行容器
docker run -d \
  -p 3000:3001 \
  --env-file .env \
  -v sqlite-data:/app/data \
  --name change-number-system \
  change-number-system:latest

# 查看容器状态
docker ps

# 查看日志
docker logs -f change-number-system
```

#### 构建和推送到阿里云镜像仓库

```bash
# 登录到阿里云镜像仓库
bash scripts/docker/login.sh

# 构建并推送
bash scripts/docker/build-and-push.sh v1.6.0
```

### GitHub Actions 配置

推送代码到 main 分支或创建 release 时，会自动构建并推送到阿里云镜像仓库。

需要配置以下内容：

**Variables**（Settings → Secrets and variables → Actions → Variables）：
| 变量名 | 值 |
|--------|-----|
| `DOCKER_REGISTRY` | `crpi-yl4pb9sg5y2myg6f.cn-hangzhou.personal.cr.aliyuncs.com` |
| `DOCKER_IMAGE_NAME` | `9992099/change_number_system` |

**Secrets**（Settings → Secrets and variables → Actions → Secrets）：
| 密钥名 | 说明 |
|--------|------|
| `ALIYUN_CR_USERNAME` | 阿里云镜像仓库用户名 |
| `ALIYUN_CR_PASSWORD` | 阿里云镜像仓库密码（或访问凭证） |

### 生产构建

```bash
npm run build:frontend
npm run build:backend
```

### 环境变量配置

生产环境需要配置以下环境变量:

- `PORT` - 后端服务端口 (默认 3001)
- `DB_PATH` - 数据库文件路径 (默认 ./data/app.db)
- `JWT_SECRET` - JWT 密钥 (必须修改)
- `ADMIN_PASSWORD` - 默认管理员密码
- `NODE_ENV` - 运行环境 (production/development)

## License

ISC
