const Database = require('better-sqlite3');

/**
 * 创建内存数据库用于测试
 * @returns {Database} 内存数据库实例
 */
function createTestDb() {
  const db = new Database(':memory:');
  
  // 配置 WAL 模式（内存数据库也应用类似配置）
  db.pragma('journal_mode = MEMORY');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  
  return db;
}

/**
 * 初始化测试数据库的表结构
 * @param {Database} db 数据库实例
 */
function initTestSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'approved' CHECK(status IN ('approved', 'pending', 'rejected')),
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME
    );
  `);

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
      category TEXT,
      sub_category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 插入默认功能开关
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description)
    VALUES (?, ?, ?)
  `);
  insertSetting.run('allow_request_project', 'false', '允许用户申请新项目代号');
  insertSetting.run('allow_request_number_type', 'false', '允许用户申请新编号类型');

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
}

/**
 * 关闭测试数据库连接
 * @param {Database} db 数据库实例
 */
function closeTestDb(db) {
  if (db) {
    db.close();
  }
}

module.exports = {
  createTestDb,
  initTestSchema,
  closeTestDb
};
