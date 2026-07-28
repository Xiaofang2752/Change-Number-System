const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dbDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dbDir, 'app.db');
const db = new Database(dbPath);

// 配置 WAL 模式
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

// 创建项目代号表
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    status TEXT DEFAULT 'approved' CHECK(status IN ('approved', 'pending', 'rejected')),
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME
  );
`);

// 创建编号类型表
db.exec(`
  CREATE TABLE IF NOT EXISTS number_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_code TEXT UNIQUE NOT NULL,
    type_name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'approved' CHECK(status IN ('approved', 'pending', 'rejected')),
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME
  );
`);

// 创建技术文件关键字表
db.exec(`
  CREATE TABLE IF NOT EXISTS technical_document_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'approved' CHECK(status IN ('approved', 'pending', 'rejected')),
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME
  );
`);

// 迁移: 移除 number_types.type_name 的 NOT NULL 约束
// SQLite 不支持直接 DROP CONSTRAINT, 需要重建表
function migrateNumberTypes() {
  try {
    // 检查是否已经迁移过: 如果旧表存在且新表不存在, 需要迁移
    const tableInfo = db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='number_types'
    `).get();

    if (!tableInfo) return; // 表不存在, 等待 CREATE TABLE IF NOT EXISTS 处理

    // 如果表已经迁移过 (type_name 没有 NOT NULL), 跳过
    if (!tableInfo.sql.includes('type_name TEXT NOT NULL')) {
      console.log('number_types table already migrated, skipping');
      return;
    }

    console.log('Migrating number_types table to remove NOT NULL constraint on type_name...');

    // 开始迁移: 重命名旧表
    db.exec(`ALTER TABLE number_types RENAME TO number_types_old`);

    // 创建新表 (移除 NOT NULL)
    db.exec(`
      CREATE TABLE number_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_code TEXT UNIQUE NOT NULL,
        type_name TEXT DEFAULT '',
        description TEXT,
        status TEXT DEFAULT 'approved' CHECK(status IN ('approved', 'pending', 'rejected')),
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME
      )
    `);

    // 复制数据
    db.exec(`
      INSERT INTO number_types (id, type_code, type_name, description, status, created_by, created_at, approved_at)
      SELECT id, type_code, COALESCE(type_name, ''), description, status, created_by, created_at, approved_at
      FROM number_types_old
    `);

    // 删除旧表
    db.exec(`DROP TABLE number_types_old`);

    console.log('number_types table migration completed');
  } catch (err) {
    console.error('Migration error:', err.message);
    // 如果迁移失败 (例如表已经不存在), 尝试恢复
    try {
      db.exec(`DROP TABLE IF EXISTS number_types_old`);
    } catch (e) {
      // 忽略清理错误
    }
  }
}

migrateNumberTypes();

function migrateApplicationsTable() {
  try {
    const columns = db.prepare(`PRAGMA table_info('applications')`).all();
    const hasDocumentName = columns.some((column) => column.name === 'document_name');
    if (!hasDocumentName) {
      console.log('Migrating applications table to add document_name column...');
      db.exec(`ALTER TABLE applications ADD COLUMN document_name TEXT`);
      console.log('applications table migration completed');
    }
  } catch (err) {
    console.error('Migration applications table error:', err.message);
  }
}

// 创建申请记录表
 db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_name TEXT NOT NULL,
    applicant_type TEXT,
    document_name TEXT,
    project_code TEXT NOT NULL,
    number_type TEXT NOT NULL,
    serial_number INTEGER NOT NULL,
    full_number TEXT NOT NULL,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

migrateApplicationsTable();

// 迁移: 为 applications 表新增 category 和 sub_category 列（技术文件取号类别化）
function migrateApplicationsCategoryTable() {
  try {
    const columns = db.prepare(`PRAGMA table_info('applications')`).all();
    const hasCategory = columns.some((column) => column.name === 'category');
    const hasSubCategory = columns.some((column) => column.name === 'sub_category');
    if (!hasCategory) {
      console.log('Migrating applications table to add category column...');
      db.exec(`ALTER TABLE applications ADD COLUMN category TEXT`);
      console.log('applications table migration: category column added');
    }
    if (!hasSubCategory) {
      console.log('Migrating applications table to add sub_category column...');
      db.exec(`ALTER TABLE applications ADD COLUMN sub_category TEXT`);
      console.log('applications table migration: sub_category column added');
    }
  } catch (err) {
    console.error('Migration applications category table error:', err.message);
  }
}

migrateApplicationsCategoryTable();

// 迁移: 为 applications 表新增 source_number 列（记录表单派生源文件编号）
function migrateApplicationsSourceNumber() {
  try {
    const columns = db.prepare(`PRAGMA table_info('applications')`).all();
    const hasSourceNumber = columns.some((column) => column.name === 'source_number');
    if (!hasSourceNumber) {
      console.log('Migrating applications table to add source_number column...');
      db.exec(`ALTER TABLE applications ADD COLUMN source_number TEXT`);
      console.log('applications table migration: source_number column added');
    }
  } catch (err) {
    console.error('Migration applications source_number error:', err.message);
  }
}

migrateApplicationsSourceNumber();

// 创建用户项目代号申请表
db.exec(`
  CREATE TABLE IF NOT EXISTS project_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    project_code TEXT NOT NULL,
    project_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('approved', 'pending', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewer_note TEXT
  );
`);

// 创建用户编号类型申请表
db.exec(`
  CREATE TABLE IF NOT EXISTS number_type_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type_code TEXT NOT NULL,
    type_name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('approved', 'pending', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewer_note TEXT
  );
`);

// 创建管理员表
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 创建 cap.js 人机验证挑战表
db.exec(`
  CREATE TABLE IF NOT EXISTS cap_challenges (
    token TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
`);

// 创建 cap.js 人机验证令牌表
db.exec(`
  CREATE TABLE IF NOT EXISTS cap_tokens (
    key TEXT PRIMARY KEY,
    expires INTEGER NOT NULL
  );
`);

// 创建系统设置表（功能开关）
db.exec(`
  CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 创建变更进度表
db.exec(`
  CREATE TABLE IF NOT EXISTS change_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code TEXT,
    cr_no TEXT,
    dcp_no TEXT,
    cn_no TEXT,
    change_description TEXT,
    affects_regulation INTEGER DEFAULT 0, -- 0 for No, 1 for Yes
    regulation_content TEXT,
    cr_progress TEXT,
    cn_progress TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 动态迁移：若存在 change_progress 表但没有 project_code 列，则添加
const changeProgressInfo = db.prepare("PRAGMA table_info(change_progress)").all();
const hasProjectCode = changeProgressInfo.some(col => col.name === 'project_code');
if (!hasProjectCode) {
  try {
    db.exec("ALTER TABLE change_progress ADD COLUMN project_code TEXT;");
    console.log("Successfully migrated change_progress table: added project_code column.");
  } catch (err) {
    console.error("Migration error for change_progress table:", err);
  }
}

// 创建贡献者表
db.exec(`
  CREATE TABLE IF NOT EXISTS contributors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 创建 10 问 10 答表（草稿/发布双状态）
db.exec(`
  CREATE TABLE IF NOT EXISTS guide_qna (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 创建 10 问 10 答历史快照表（整版归档）
db.exec(`
  CREATE TABLE IF NOT EXISTS guide_qna_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_label TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 迁移: 首次启动时把现有 10 条硬编码内容作为初始 published 版插入
function migrateGuideQna() {
  try {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM guide_qna').get();
    if (count.cnt > 0) return;

    console.log('Migrating guide_qna: inserting seed data (10 Q&A)...');
    const seedQna = [
      { q: '第1次走DCP-CR-CN，应该如何操作？', a: '请先确认所属项目：\n\n- 若属于国内外通用项目，请按照【通用版】操作指南执行；\n- 若属于 WBDL / DSH 项目，请按照【Diasorin版】操作指南执行。\n\n![DCP SOP CM](/images/guide/DCPSop-CM.png)\n\n![DCP SOP Diasorin](/images/guide/DCPSop-Diasorin.png)' },
      { q: 'QBC-AT 应用软件由客户维护，由客户提供软件包，此类情况如何处理？', a: '按以下步骤执行：\n\n1. 发起【外来文件受控审批】钉钉流程；\n2. 发起【TD技术文件审批受控】钉钉流程，将客户软件包+验证报告（签字版）等作为技术文件受控到服务器；\n3. 发起【CN变更通知】钉钉流程，填写CI实施表作为附件。\n\n法规依据：\n\n- ISO 13485:2016 4.2.4（外来文件控制）\n- ISO 13485:2016 7.5.6（生产和服务提供过程确认）\n- 21 CFR 820.30（设计控制）' },
      { q: '现有项目风险管理文件未识别本次变更风险，应如何补充登记？', a: '请在钉钉在线文档中，找到对应项目并补充登记相关风险：\n\n[钉钉在线文档](https://alidocs.dingtalk.com/i/nodes/m9bN7RYPWdXnZE5ptkPlRPXeWZd1wyK0?utm_scene=person_space)\n\n注意：ODBC / WBDL / DSH 涉及文档交付物，请及时更新相关风险文档，如 FMECA 等。' },
      { q: 'DCP 中"成本影响"应如何填写？', a: '参考QST-MS04-01-001-R003《变更影响评估表》：\n\n- 若变更导致成本下降：填写"整机 BOM 成本无增加"；\n- 若成本上升：按实际金额填写（如"整机 BOM 成本增加 XX 元"）。' },
      { q: '产线仪器有通过返工单升级，那研发机又当如何记录？', a: '请填写QST-MS04-01-001-R018 《研发仪器更改确认单R&D Instrument Change Checklist》，完成记录并及时归档。\n\n法规依据：\n\n- ISO 13485:2016 7.6（监视和测量设备控制）\n- ISO 13485:2016 4.2.5（记录控制）' },
      { q: '所有文档升版都需要走DCP吗？', a: '分两种情况：\n\n- 纯文件优化（如文字修订，不影响产品规格/性能等）→ 直接走文件升版流程（拟制-审核-批准），不需要走DCP；\n- 设计变更引起的文件升版（先有设计变更，文档跟着改）→ 需要走DCP，文件作为变更的附件捆绑升版（适用于DHF、DMR文件）。' },
      { q: '变更分析的"N/A"和"无影响"如何区分？为什么写N/A会被批注？', a: '"N/A"表示不适用，但需说明理由。无理由的"N/A"无法证明是否经过充分评估，易被客户等审查质疑；\n\n"无影响"表示已完成分析后的结论。' },
      { q: 'DCP第5章节交付物中的SVN路径怎么写？', a: '需填写两类路径：\n\n- 项目组 SVN 路径：确保原始资料可继承；\n- 受控路径：用于文控归档及审核核查。\n\n法规依据：\n\n- ISO 13485:2016 4.2.4（文件可追溯性与控制）\n- 21 CFR 820.180（记录可获取性）' },
      { q: '多份 DCP 存在配套变更，交付物是否需要体现？', a: '需要体现。建议：\n\n- 在DCP交付物表格下增加备注说明：该交付物属于配套变更，将由其他 DCP 实施；\n- 在CI实施表（C列，文件类型）中选择"延迟生效"等选项，明确不随当前 DCP 生效。' },
      { q: '钉钉流程CR 变更申请中的"共同编制人（Co-compiler）"如何选择？', a: '按实际参与变更的工程师选择：\n\n- 涉及哪些专业，就选择对应工程师；\n- 如机械变更影响软件，应同时选择机械、软件工程师；\n- 如交付物中涉及SOP，应同时选择工艺工程师；\n\n原则：谁参与交付物或评估，谁纳入共同编制确认。' },
    ];

    const insert = db.prepare(`
      INSERT INTO guide_qna (sort_order, question, answer, status, updated_at)
      VALUES (?, ?, ?, 'published', CURRENT_TIMESTAMP)
    `);
    const tx = db.transaction(() => {
      seedQna.forEach((item, idx) => insert.run(idx + 1, item.q, item.a));
    });
    tx();
    console.log('guide_qna seed data inserted: 10 Q&A (published)');
  } catch (err) {
    console.error('Migration guide_qna error:', err.message);
  }
}

// 插入预设数据
const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects (code, name, status, approved_at)
  VALUES (?, ?, 'approved', CURRENT_TIMESTAMP)
`);

const insertNumberType = db.prepare(`
  INSERT OR IGNORE INTO number_types (type_code, type_name, description, status, approved_at)
  VALUES (?, ?, '', 'approved', CURRENT_TIMESTAMP)
`);

// 事务插入预设数据
const insertPresets = db.transaction(() => {
  insertProject.run('ALPHA01', 'Alpha Project 01');
  insertProject.run('BETA88', 'Beta Project 88');
  insertProject.run('NOVA02', 'Nova Project 02');

  insertNumberType.run('CR', 'Change Request');
  insertNumberType.run('DCP', 'Design Change Proposal');
  insertNumberType.run('CN', 'Change Notice');
  insertNumberType.run('TD', 'Technical Document');
  insertNumberType.run('QTD', 'Quaero Technical Document');

  // 插入默认功能开关（默认关闭）
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description)
    VALUES (?, ?, ?)
  `);
  insertSetting.run('allow_request_project', 'false', '允许用户申请新项目代号');
  insertSetting.run('allow_request_number_type', 'false', '允许用户申请新编号类型');
});

insertPresets();
migrateGuideQna();

console.log('Database initialized successfully with WAL mode');
console.log('Tables created: projects, number_types, applications, project_requests, number_type_requests, admins, cap_challenges, cap_tokens, system_settings, change_progress, contributors, guide_qna, guide_qna_history');
console.log('Preset data inserted: 3 projects, 3 number types, 2 feature toggles');

module.exports = db;
