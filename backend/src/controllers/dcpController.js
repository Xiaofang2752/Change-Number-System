const { getDatabase } = require('../db/connection');
const { successResponse, errorResponse } = require('../middlewares/response');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// 支持的文档模板类型
const DOC_TEMPLATE_TYPES = {
  DCP: 'DCP《设计变更方案》',
  IMPACT: '《变更影响评估表》',
  RISK: '《风险登记册》',
};
const VALID_TYPES = Object.keys(DOC_TEMPLATE_TYPES);

function normalizeType(raw) {
  if (!raw) return null;
  const t = String(raw).toUpperCase();
  return VALID_TYPES.includes(t) ? t : null;
}

/**
 * 管理员上传某类文档模板（版本化：每次上传新增一个版本）
 * 类型通过查询参数 ?type=DCP|IMPACT|RISK 指定
 * multer 在路由层以 single('file') 注入 req.file
 */
function uploadDocTemplate(req, res) {
  try {
    const type = normalizeType(req.query.type);
    if (!type) {
      return errorResponse(res, 400, '缺少或非法的模板类型 type（应为 DCP / IMPACT / RISK）');
    }
    if (!req.file) {
      return errorResponse(res, 400, '请上传模板文件');
    }
    const originalName = req.file.originalname || '';
    const lowerName = originalName.toLowerCase();
    if (!lowerName.endsWith('.docx') && !lowerName.endsWith('.xlsx')) {
      return errorResponse(res, 400, '模板仅支持 .docx（Word）或 .xlsx（Excel）格式');
    }
    const db = getDatabase();
    const createdBy = req.admin?.username || req.admin?.id || null;
    const info = db.prepare(
      `INSERT INTO doc_templates (template_type, filename, content, published_at, created_by)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)`
    ).run(type, originalName, req.file.buffer, createdBy);

    return successResponse(res, { id: info.lastInsertRowid, type, filename: originalName, size: req.file.size }, `${DOC_TEMPLATE_TYPES[type]} 模板上传成功（已新增版本）`);
  } catch (err) {
    console.error('Upload doc template error:', err);
    return errorResponse(res, 500, '上传模板失败');
  }
}

/**
 * 获取某类模板元信息（不含二进制内容），供管理员页展示状态与版本历史
 * 类型通过查询参数 ?type=DCP|IMPACT|RISK 指定
 */
function getDocTemplateMeta(req, res) {
  try {
    const type = normalizeType(req.query.type);
    if (!type) {
      return errorResponse(res, 400, '缺少或非法的模板类型 type（应为 DCP / IMPACT / RISK）');
    }
    const db = getDatabase();
    const latest = db.prepare('SELECT id, filename, published_at FROM doc_templates WHERE template_type = ? ORDER BY published_at DESC LIMIT 1').get(type);
    const versions = db.prepare('SELECT id, filename, published_at, created_by FROM doc_templates WHERE template_type = ? ORDER BY published_at DESC').all(type);
    return successResponse(res, {
      type,
      exists: !!latest,
      filename: latest?.filename || null,
      updated_at: latest?.published_at || null,
      latest_id: latest?.id || null,
      versions,
    });
  } catch (err) {
    console.error('Get doc template meta error:', err);
    return errorResponse(res, 500, '获取模板信息失败');
  }
}

/**
 * 按申请 id 生成并下载已填充的某类文档 .docx
 * 使用"申请时间当日或之前发布"的该类型最新模板版本（版本随申请时间对应模板迭代）。
 * 若申请时间早于该类型任何模板发布时间，则不支持下载。
 */
function downloadDoc(req, res) {
  try {
    const type = normalizeType(req.params.type);
    if (!type) {
      return errorResponse(res, 400, '非法的模板类型');
    }
    const { id } = req.params;
    const db = getDatabase();
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    if (!app) {
      return errorResponse(res, 404, '申请记录不存在');
    }

    // 取申请时间当日或之前发布的最新模板版本
    const tpl = db.prepare(
      `SELECT id, content, filename, published_at
       FROM doc_templates
       WHERE template_type = ? AND DATE(published_at) <= DATE(?)
       ORDER BY published_at DESC
       LIMIT 1`
    ).get(type, app.created_at);
    if (!tpl || !tpl.content) {
      return errorResponse(res, 400, `该编号申请时间早于${DOC_TEMPLATE_TYPES[type]}模板发布时间，暂不支持下载`);
    }

    const data = {
      dcp_no: app.full_number,
      project_code: app.project_code || '',
      applicant_name: app.applicant_name || '',
      date: (app.created_at || '').split(' ')[0] || '',
    };

    const lowerName = (tpl.filename || '').toLowerCase();
    const isXlsx = lowerName.endsWith('.xlsx');
    const ext = isXlsx ? 'xlsx' : 'docx';
    const mimeType = isXlsx
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : DOCX_MIME;

    let buf;
    if (isXlsx) {
      // Excel 模板：直接原样下发（暂不做占位符填充）
      buf = Buffer.from(tpl.content);
    } else {
      try {
        const zip = new PizZip(tpl.content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
        doc.render(data);
        buf = doc.getZip().generate({ type: 'nodebuffer', mimeType: DOCX_MIME });
      } catch (renderErr) {
        console.error('Render docx error:', renderErr);
        return errorResponse(res, 500, '模板渲染失败，请检查模板中的占位符语法（如 {dcp_no}）');
      }
    }

    const baseName = DOC_TEMPLATE_TYPES[type].replace(/[《》]/g, '');
    const encodedName = encodeURIComponent(`${baseName}-${app.full_number}.${ext}`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="doc.${ext}"; filename*=UTF-8''${encodedName}`
    );
    return res.status(200).send(buf);
  } catch (err) {
    console.error('Download docx error:', err);
    return errorResponse(res, 500, '生成文档失败');
  }
}

// 兼容旧入口：/dcp/:id 等同于 DCP 类型下载
function downloadDcp(req, res) {
  req.params.type = 'DCP';
  return downloadDoc(req, res);
}

/**
 * 一键打包下载：将该 DCP 申请当前可用的三类表单（DCP《设计变更方案》/《变更影响评估表》/《风险登记册》）
 * 按各自"申请时间对应版本"打包为 ZIP，压缩包内以 DCP 编号命名的文件夹包含各文件。
 */
function downloadBundle(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    if (!app) {
      return errorResponse(res, 404, '申请记录不存在');
    }
    if (app.number_type !== 'DCP') {
      return errorResponse(res, 400, '该记录不是 DCP 申请，无法打包下载');
    }

    const zip = new PizZip();
    let added = 0;
    for (const type of VALID_TYPES) {
      const tpl = db.prepare(
        `SELECT id, content, filename, published_at
         FROM doc_templates
         WHERE template_type = ? AND DATE(published_at) <= DATE(?)
         ORDER BY published_at DESC
         LIMIT 1`
      ).get(type, app.created_at);
      if (!tpl || !tpl.content) continue;

      const lower = (tpl.filename || '').toLowerCase();
      const ext = lower.endsWith('.xlsx') ? 'xlsx' : 'docx';
      const baseName = DOC_TEMPLATE_TYPES[type].replace(/[《》]/g, '');
      const fileName = `${baseName}-${app.full_number}.${ext}`;
      zip.file(`${app.full_number}/${fileName}`, Buffer.from(tpl.content));
      added++;
    }

    if (added === 0) {
      return errorResponse(res, 400, '该编号申请时间早于所有模板发布时间，暂不支持下载');
    }

    const buf = zip.generate({ type: 'nodebuffer', mimeType: 'application/zip' });
    const encodedName = encodeURIComponent(`${app.full_number}.zip`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="doc.zip"; filename*=UTF-8''${encodedName}`
    );
    return res.status(200).send(buf);
  } catch (err) {
    console.error('Download bundle error:', err);
    return errorResponse(res, 500, '打包下载失败');
  }
}

module.exports = {
  uploadDocTemplate,
  getDocTemplateMeta,
  downloadDoc,
  downloadDcp,
  downloadBundle,
};
