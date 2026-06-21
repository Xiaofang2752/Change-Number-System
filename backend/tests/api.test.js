// Simplified test suite that focuses on core functionality
const { setupTestEnv, generateAdminToken, createAdminInDb, closeTestDb, request } = require('./testHelper');

describe('后端 API 基础测试', () => {
  let app, db, adminToken;

  beforeEach(async () => {
    const env = setupTestEnv();
    app = env.app;
    db = env.db;
    await createAdminInDb(db);
    adminToken = generateAdminToken();
  });

  afterEach(() => {
    closeTestDb(db);
  });

  describe('数据库初始化', () => {
    test('应该成功创建所有表', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map(t => t.name);
      
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('number_types');
      expect(tableNames).toContain('technical_document_keywords');
      expect(tableNames).toContain('applications');
      expect(tableNames).toContain('admins');
    });

    test('应该支持插入和查询数据', () => {
      db.prepare("INSERT INTO projects (code, name) VALUES ('TEST', 'Test Project')").run();
      const project = db.prepare("SELECT * FROM projects WHERE code = 'TEST'").get();
      
      expect(project).toBeDefined();
      expect(project.code).toBe('TEST');
    });
  });

  describe('健康检查', () => {
    test('应该返回成功响应', async () => {
      // 测试任意现有端点
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('IP 工具', () => {
    test('应该从请求中提取 IP', () => {
      const { getClientIP } = require('../src/utils/ip');
      const req = { headers: { 'x-forwarded-for': '192.168.1.1' } };
      expect(getClientIP(req)).toBe('192.168.1.1');
    });

    test('应该验证 IPv4 地址', () => {
      const { isValidIP } = require('../src/utils/ip');
      expect(isValidIP('192.168.1.1')).toBe(true);
      expect(isValidIP('invalid')).toBe(false);
    });
  });

  describe('管理员认证', () => {
    test('管理员应该能够登录', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'Aa123456' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
    });
  });

  describe('项目 API', () => {
    test('应该能够获取项目列表', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('管理员应该能够创建项目', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'TEST001', name: 'Test Project' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe('TEST001');
    });
  });

  describe('编号类型 API', () => {
    test('应该能够获取编号类型列表', async () => {
      const res = await request(app).get('/api/number-types');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('技术文件关键字 API', () => {
    test('管理员应该能够创建和获取关键字', async () => {
      const createRes = await request(app)
        .post('/api/technical-documents/keywords')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ keyword: 'TESTKEY', description: '测试关键字' });
      expect(createRes.status).toBe(200);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.keyword).toBe('TESTKEY');

      const listRes = await request(app).get('/api/technical-documents/keywords');
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.some((item) => item.keyword === 'TESTKEY')).toBe(true);
    });

    test('管理员应该能够导入现有 QTD 编号', async () => {
      // 确保没有关键字也能导入无关键字 QTD 编号
      const importRes = await request(app)
        .post('/api/technical-documents/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entries: ['QTD-000001'],
          project_code: 'ALPHA01',
          applicant_name: '管理员'
        });
      expect(importRes.status).toBe(200);
      expect(importRes.body.success).toBe(true);
      expect(importRes.body.data.imported).toContain('QTD-000001');
    });
  });

  describe('申请记录 API', () => {
    test('用户应该能够提交申请', async () => {
      // 先创建必要的数据
      db.prepare("INSERT INTO projects (code, name) VALUES ('ALPHA01', 'Test')").run();
      db.prepare("INSERT INTO number_types (type_code, type_name) VALUES ('CR', 'Test')").run();

      const res = await request(app)
        .post('/api/applications')
        .send({
          applicant_name: '测试用户',
          project_code: 'ALPHA01',
          number_type: 'CR'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.full_number).toContain('CR-ALPHA01');
    });

    test('QTD 申请应保存文档名称', async () => {
      db.prepare("INSERT INTO technical_document_keywords (keyword, status) VALUES ('ALPHA01', 'approved')").run();
      db.prepare("INSERT INTO number_types (type_code, type_name) VALUES ('QTD', 'Technical Document')").run();

      const res = await request(app)
        .post('/api/applications')
        .send({
          applicant_name: '技术用户',
          document_name: 'DHF 文档示例',
          project_code: 'ALPHA01',
          number_type: 'QTD'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.full_number).toContain('QTD-ALPHA01');
      expect(res.body.data.document_name).toBe('DHF 文档示例');
    });
  });

  describe('贡献者 API', () => {
    test('应该能够获取贡献者列表且按积分排序', async () => {
      // 插入两个测试贡献者
      db.prepare("INSERT INTO contributors (name, points, description) VALUES ('测试A', 10, 'A description')").run();
      db.prepare("INSERT INTO contributors (name, points, description) VALUES ('测试B', 20, 'B description')").run();

      const res = await request(app).get('/api/contributors');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // 测试B（20分）应该排在测试A（10分）前面
      const indexA = res.body.data.findIndex(c => c.name === '测试A');
      const indexB = res.body.data.findIndex(c => c.name === '测试B');
      expect(indexB).toBeLessThan(indexA);
    });

    test('管理员应该能够创建贡献者', async () => {
      const res = await request(app)
        .post('/api/contributors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '新贡献者', points: 15, description: '测试贡献' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('新贡献者');
      expect(res.body.data.points).toBe(15);
    });

    test('管理员应该能够更新贡献者', async () => {
      db.prepare("INSERT INTO contributors (name, points, description) VALUES ('更新测试', 5, 'old')").run();
      const cont = db.prepare("SELECT id FROM contributors WHERE name = '更新测试'").get();

      const res = await request(app)
        .put(`/api/contributors/${cont.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '更新测试新', points: 30, description: 'new' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('更新测试新');
      expect(res.body.data.points).toBe(30);
    });

    test('管理员应该能够删除贡献者', async () => {
      db.prepare("INSERT INTO contributors (name, points) VALUES ('删除测试', 5)").run();
      const cont = db.prepare("SELECT id FROM contributors WHERE name = '删除测试'").get();

      const res = await request(app)
        .delete(`/api/contributors/${cont.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = db.prepare("SELECT * FROM contributors WHERE id = ?").get(cont.id);
      expect(check).toBeUndefined();
    });
  });
});
