const Database = require('better-sqlite3');
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_number TEXT, project_code TEXT, number_type TEXT,
    applicant_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE dcp_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT, content BLOB, published_at DATETIME, created_by TEXT
  );
`);
db.prepare('INSERT INTO dcp_templates (filename, content, published_at) VALUES (?,?,?)').run('A.docx','A','2026-08-06 10:00:00');
db.prepare('INSERT INTO dcp_templates (filename, content, published_at) VALUES (?,?,?)').run('B.docx','B','2026-08-09 10:00:00');
const ins = db.prepare("INSERT INTO applications (full_number, project_code, number_type, applicant_name, created_at) VALUES (?,?,?,?,?)");
ins.run('DCP-X-0001','X','DCP','a','2026-08-05 09:00:00');
ins.run('DCP-X-0002','X','DCP','a','2026-08-06 11:00:00');
ins.run('DCP-X-0003','X','DCP','a','2026-08-09 11:00:00');
ins.run('DCP-X-0004','X','DCP','a','2026-08-10 11:00:00');
ins.run('CR-X-0001','X','CR','a','2026-08-09 11:00:00');
const asOf = db.prepare(`SELECT id, filename FROM dcp_templates WHERE DATE(published_at) <= DATE(?) ORDER BY published_at DESC LIMIT 1`);
console.log('--- as-of download template per DCP app ---');
for (const app of db.prepare("SELECT * FROM applications WHERE number_type='DCP' ORDER BY created_at").all()) {
  const t = asOf.get(app.created_at);
  console.log(app.full_number, app.created_at, '->', t ? t.filename : 'NONE(400)');
}
console.log('--- dcp_template_id subquery + count ---');
const query = `SELECT a.*, (SELECT t.id FROM dcp_templates t WHERE DATE(t.published_at) <= DATE(a.created_at) ORDER BY t.published_at DESC LIMIT 1) AS dcp_template_id FROM applications a`;
const countQuery = query.replace(/SELECT[\s\S]*?FROM applications a/, 'SELECT COUNT(*) as total FROM applications a');
console.log('countQuery:', countQuery);
const { total } = db.prepare(countQuery).all();
console.log('total:', total.total);
for (const r of db.prepare(query).all()) {
  console.log(r.full_number, 'dcp_template_id=', r.dcp_template_id);
}
