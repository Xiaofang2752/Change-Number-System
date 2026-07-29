const { getDatabase } = require('../db/connection');
const { successResponse, errorResponse } = require('../middlewares/response');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * 管理员上传 DCP《设计变更方案》Word 模板（单例，覆盖式存储）
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
    db.prepare(
      `INSERT INTO dcp_template (id, filename, content, updated_at)
       VALUES (1, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET filename = excluded.filename, content = excluded.content, updated_at = CURRENT_TIMESTAMP`
    ).run(originalName, req.file.buffer);

    return successResponse(res, { filename: originalName, size: req.file.size }, '模板上传成功');
  } catch (err) {
    console.error('Upload DCP template error:', err);
    return errorResponse(res, 500, '上传模板失败');
  }
}

/**
 * 获取当前模板元信息（不含二进制内容），供管理员页展示状态
 */
function getTemplateMeta(req, res) {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT filename, updated_at FROM dcp_template WHERE id = 1').get();
    return successResponse(res, {
      exists: !!row,
      filename: row?.filename || null,
      updated_at: row?.updated_at || null,
    });
  } catch (err) {
    console.error('Get DCP template meta error:', err);
    return errorResponse(res, 500, '获取模板信息失败');
  }
}

/**
 * 按申请 id 生成并下载已填充的 DCP《设计变更方案》.docx
 * 仅支持 number_type = 'DCP' 的申请；DCP No. 自动填充为申请编号
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
    const tpl = db.prepare('SELECT content, filename FROM dcp_template WHERE id = 1').get();
    if (!tpl || !tpl.content) {
      return errorResponse(res, 400, '尚未配置 DCP 模板，请联系管理员在后台上传');
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
      return errorResponse(res, 500, '模板渲染失败，请检查模板中的占位符语法（{{dcp_no}} 等）');
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
