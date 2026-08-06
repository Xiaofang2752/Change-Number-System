const { getDatabase } = require('../db/connection');
const { successResponse, errorResponse } = require('../middlewares/response');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * 管理员上传 DCP《设计变更方案》Word 模板（版本化：每次上传新增一个版本）
 * multer 在路由层以 single('file') 注入 req.file
 */
function uploadTemplate(req, res) {
  try {
    if (!req.file) {
      return errorResponse(res, 400, '请上传模板文件');
    }
    const originalName = req.file.originalname || '';
    if (!originalName.toLowerCase().endsWith('.docx')) {
      return errorResponse(res, 400, '模板仅支持 .docx 格式的 Word 文档');
    }
    const db = getDatabase();
    const createdBy = req.admin?.username || req.admin?.id || null;
    const info = db.prepare(
      `INSERT INTO dcp_templates (filename, content, published_at, created_by)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?)`
    ).run(originalName, req.file.buffer, createdBy);

    return successResponse(res, { id: info.lastInsertRowid, filename: originalName, size: req.file.size }, '模板上传成功（已新增版本）');
  } catch (err) {
    console.error('Upload DCP template error:', err);
    return errorResponse(res, 500, '上传模板失败');
  }
}

/**
 * 获取模板元信息（不含二进制内容），供管理员页展示状态与版本历史
 */
function getTemplateMeta(req, res) {
  try {
    const db = getDatabase();
    const latest = db.prepare('SELECT id, filename, published_at FROM dcp_templates ORDER BY published_at DESC LIMIT 1').get();
    const versions = db.prepare('SELECT id, filename, published_at, created_by FROM dcp_templates ORDER BY published_at DESC').all();
    return successResponse(res, {
      exists: !!latest,
      filename: latest?.filename || null,
      updated_at: latest?.published_at || null,
      latest_id: latest?.id || null,
      versions,
    });
  } catch (err) {
    console.error('Get DCP template meta error:', err);
    return errorResponse(res, 500, '获取模板信息失败');
  }
}

/**
 * 按申请 id 生成并下载已填充的 DCP《设计变更方案》.docx
 * 仅支持 number_type = 'DCP' 的申请；
 * 使用"申请时间当日或之前发布"的最新模板版本（版本随申请时间对应模板迭代）。
 * 若申请时间早于任何模板发布时间，则不支持下载。
 */
function downloadFilled(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    if (!app) {
      return errorResponse(res, 404, '申请记录不存在');
    }
    if (app.number_type !== 'DCP') {
      return errorResponse(res, 400, '该记录不是 DCP 申请，无法生成《设计变更方案》');
    }
    // 取申请时间当日或之前发布的最新模板版本
    const tpl = db.prepare(
      `SELECT id, content, filename, published_at
       FROM dcp_templates
       WHERE DATE(published_at) <= DATE(?)
       ORDER BY published_at DESC
       LIMIT 1`
    ).get(app.created_at);
    if (!tpl || !tpl.content) {
      return errorResponse(res, 400, '该编号申请时间早于 DCP 模板发布时间，暂不支持下载《设计变更方案》');
    }

    const data = {
      dcp_no: app.full_number,
      project_code: app.project_code || '',
      applicant_name: app.applicant_name || '',
      date: (app.created_at || '').split(' ')[0] || '',
    };

    let doc;
    try {
      const zip = new PizZip(tpl.content);
      doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render(data);
    } catch (renderErr) {
      console.error('Render DCP docx error:', renderErr);
      return errorResponse(res, 500, '模板渲染失败，请检查模板中的占位符语法（{dcp_no} 等）');
    }

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      mimeType: DOCX_MIME,
    });

    const encodedName = encodeURIComponent(`DCP设计变更方案-${app.full_number}.docx`);
    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dcp.docx"; filename*=UTF-8''${encodedName}`
    );
    return res.status(200).send(buf);
  } catch (err) {
    console.error('Download DCP docx error:', err);
    return errorResponse(res, 500, '生成 DCP 文档失败');
  }
}

module.exports = {
  uploadTemplate,
  getTemplateMeta,
  downloadFilled,
};
