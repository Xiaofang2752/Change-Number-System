const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { errorHandler, notFoundHandler } = require('./middlewares/error');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 初始化数据库
require('./db/init');

// 导入路由
const projectsRouter = require('./routes/projects');
const numberTypesRouter = require('./routes/number-types');
const applicationsRouter = require('./routes/applications');
const technicalDocumentRouter = require('./routes/technical-documents');
const adminRouter = require('./routes/admin');
const capRouter = require('./routes/cap');
const settingsRouter = require('./routes/settings');
const changeProgressRouter = require('./routes/change-progress');
const contributorsRouter = require('./routes/contributors');
const guideQnaRouter = require('./routes/guide-qna');
const dcpRouter = require('./routes/dcp');
const { initializeDefaultAdmin } = require('./controllers/adminController');

const app = express();

// 初始化管理员
initializeDefaultAdmin();

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 在生产环境下服务前端静态文件
const publicDir = path.join(__dirname, '..', 'public');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(publicDir));
  
  // 对于非 API 路由，返回 index.html (支持 SPA 路由)
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/cap')) {
      res.sendFile(path.join(publicDir, 'index.html'));
    } else {
      next();
    }
  });
}

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 路由
app.use('/api/projects', projectsRouter);
app.use('/api/number-types', numberTypesRouter);
app.use('/api/technical-documents', technicalDocumentRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/change-progress', changeProgressRouter);
app.use('/api/contributors', contributorsRouter);
app.use('/api/guide-qna', guideQnaRouter);
app.use('/api/dcp', dcpRouter);
app.use('/cap', capRouter);

// 错误处理
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
