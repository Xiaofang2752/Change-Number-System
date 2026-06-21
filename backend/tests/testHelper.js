const request = require('supertest');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createTestDb, initTestSchema, closeTestDb } = require('./testDb');

// 模拟 dotenv 并设置测试环境变量
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing';
process.env.ADMIN_PASSWORD = 'Aa123456';

// 模拟 getDatabase 函数
jest.mock('../src/db/connection', () => {
  let testDb = null;

  return {
    getDatabase: () => {
      if (!testDb) {
        throw new Error('Database not initialized. Call setTestDb first.');
      }
      return testDb;
    },
    setTestDb: (db) => {
      testDb = db;
    }
  };
});

const { setTestDb } = require('../src/db/connection');
const projectsRouter = require('../src/routes/projects');
const numberTypesRouter = require('../src/routes/number-types');
const applicationsRouter = require('../src/routes/applications');
const technicalDocumentsRouter = require('../src/routes/technical-documents');
const adminRouter = require('../src/routes/admin');
const settingsRouter = require('../src/routes/settings');
const contributorsRouter = require('../src/routes/contributors');

/**
 * 创建测试用 Express 应用
 */
function createTestApp() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 路由
  app.use('/api/projects', projectsRouter);
  app.use('/api/number-types', numberTypesRouter);
  app.use('/api/technical-documents', technicalDocumentsRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/contributors', contributorsRouter);

  return app;
}

/**
 * 创建完整的测试环境
 */
function setupTestEnv() {
  const db = createTestDb();
  initTestSchema(db);
  setTestDb(db);
  
  const app = createTestApp();
  
  const close = () => {
    closeTestDb(db);
  };

  return { app, db, close };
}

/**
 * 生成管理员认证 Token
 */
function generateAdminToken() {
  return jwt.sign(
    { isAdmin: true, username: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * 在测试数据库中创建管理员
 */
async function createAdminInDb(db, username = 'admin', password = 'Aa123456') {
  const passwordHash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
}

module.exports = {
  createTestApp,
  setupTestEnv,
  generateAdminToken,
  createAdminInDb,
  closeTestDb,
  request
};
