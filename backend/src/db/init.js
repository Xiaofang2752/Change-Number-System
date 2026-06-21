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

// 插入预设数据
const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects (code, name, status, approved_at)
  VALUES (?, ?, 'approved', CURRENT_TIMESTAMP)
`);

const insertNumberType = db.prepare(`
  INSERT OR IGNORE INTO number_types (type_code, type_name, description, status, approved_at)
  VALUES (?, ?, '', 'approved', CURRENT_TIMESTAMP)
`);

const insertContributor = db.prepare(`
  INSERT OR IGNORE INTO contributors (name, points, description)
  VALUES (?, ?, ?)
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

  insertContributor.run('张三', 10, '反馈了变更流程的卡顿问题，协助优化了用户体验');
  insertContributor.run('李四', 8, '对DCP/CR/CN取号生成规则提出了修正意见，修正了历史遗留逻辑Bug');
  insertContributor.run('王五', 5, '提供了Excel模板快速填充的合理化格式改进建议');

  // 插入默认功能开关（默认关闭）
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description)
    VALUES (?, ?, ?)
  `);
  insertSetting.run('allow_request_project', 'false', '允许用户申请新项目代号');
  insertSetting.run('allow_request_number_type', 'false', '允许用户申请新编号类型');
});

insertPresets();

console.log('Database initialized successfully with WAL mode');
console.log('Tables created: projects, number_types, applications, project_requests, number_type_requests, admins, cap_challenges, cap_tokens, system_settings');
console.log('Preset data inserted: 3 projects, 3 number types, 2 feature toggles');

module.exports = db;
