const { getDatabase } = require('../db/connection');
const { successResponse, errorResponse } = require('../middlewares/response');
const { getClientIP } = require('../utils/ip');

/**
 * 获取技术文件关键字列表
 */
function getKeywords(req, res) {
  try {
    const { status } = req.query;
    const db = getDatabase();

    let query = 'SELECT * FROM technical_document_keywords';
    const params = [];

    if (status) {
      const statusList = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statusList.length > 0) {
        const placeholders = statusList.map(() => '?').join(', ');
        query += ` WHERE status IN (${placeholders})`;
        params.push(...statusList);
      }
    }

    query += " ORDER BY CASE WHEN status = 'approved' THEN 0 ELSE 1 END, created_at DESC";

    const keywords = db.prepare(query).all(...params);
    return successResponse(res, keywords);
  } catch (error) {
    console.error('Get technical document keywords error:', error);
    return errorResponse(res, 500, '获取技术文件关键字失败');
  }
}

/**
 * 创建技术文件关键字
 */
function createKeyword(req, res) {
  try {
    const { keyword, description } = req.body;

    if (!keyword) {
      return errorResponse(res, 400, '关键字不能为空');
    }

    const db = getDatabase();
    const result = db.prepare(
      'INSERT INTO technical_document_keywords (keyword, description, status, approved_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
    ).run(keyword, description || '', 'approved');

    const created = db.prepare('SELECT * FROM technical_document_keywords WHERE id = ?').get(result.lastInsertRowid);
    return successResponse(res, created, '关键字创建成功');
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return errorResponse(res, 409, '关键字已存在');
    }
    console.error('Create technical document keyword error:', error);
    return errorResponse(res, 500, '创建关键字失败');
  }
}

/**
 * 更新技术文件关键字
 */
function updateKeyword(req, res) {
  try {
    const { id } = req.params;
    const { keyword, description, status } = req.body;

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM technical_document_keywords WHERE id = ?').get(id);

    if (!existing) {
      return errorResponse(res, 404, '关键字不存在');
    }

    const updateKeyword = keyword !== undefined ? keyword : existing.keyword;
    const updateDescription = description !== undefined ? description : existing.description;
    const updateStatus = status || existing.status;
    const approvedAt = updateStatus === 'approved' && existing.status !== 'approved' ? 'CURRENT_TIMESTAMP' : 'approved_at';

    db.prepare(
      `UPDATE technical_document_keywords SET keyword = ?, description = ?, status = ?, approved_at = CASE WHEN ? = 'approved' AND status != 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END WHERE id = ?`
    ).run(updateKeyword, updateDescription, updateStatus, updateStatus, id);

    const updated = db.prepare('SELECT * FROM technical_document_keywords WHERE id = ?').get(id);
    return successResponse(res, updated, '关键字更新成功');
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return errorResponse(res, 409, '关键字已存在');
    }
    console.error('Update technical document keyword error:', error);
    return errorResponse(res, 500, '更新关键字失败');
  }
}

/**
 * 删除技术文件关键字
 */
function deleteKeyword(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const result = db.prepare('DELETE FROM technical_document_keywords WHERE id = ?').run(id);
    if (result.changes === 0) {
      return errorResponse(res, 404, '关键字不存在');
    }

    return successResponse(res, null, '关键字删除成功');
  } catch (error) {
    console.error('Delete technical document keyword error:', error);
    return errorResponse(res, 500, '删除关键字失败');
  }
}

/**
 * 导入技术文件现有编号
 */
async function importApplications(req, res) {
  try {
    const { entries, applicant_name, project_code } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return errorResponse(res, 400, '请提供要导入的编号列表');
    }

    if (!project_code || !String(project_code).trim()) {
      return errorResponse(res, 400, '请提供项目代号');
    }

    if (!applicant_name || !String(applicant_name).trim()) {
      return errorResponse(res, 400, '请提供导入人姓名');
    }

    const db = getDatabase();
    const insertStmt = db.prepare(
      'INSERT INTO applications (applicant_name, applicant_type, project_code, number_type, serial_number, full_number, ip_address, document_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const imported = [];
    const skipped = [];
    const errors = [];
    const ipAddress = getClientIP(req) || '';
    const operator = String(applicant_name).trim();
    const normalizedProjectCode = String(project_code).trim();

    for (let index = 0; index < entries.length; index += 1) {
      const raw = entries[index];
      const line = String(raw || '').trim();
      if (!line) {
        continue;
      }

      // 支持英文或中文逗号分割，如："QTD-ALPHA01-0001,产品说明书" 或 "QTD-ALPHA01-0001，产品说明书"
      const commaIndex = line.search(/[,，]/);
      let fullNumber = '';
      let documentName = '';
      if (commaIndex !== -1) {
        fullNumber = line.substring(0, commaIndex).trim();
        documentName = line.substring(commaIndex + 1).trim();
      } else {
        fullNumber = line;
      }

      if (!fullNumber) {
        errors.push({ line, reason: '编号不能为空' });
        continue;
      }

      const existingApp = db.prepare('SELECT id FROM applications WHERE full_number = ?').get(fullNumber);
      if (existingApp) {
        skipped.push({ line: fullNumber, reason: '记录已存在' });
        continue;
      }

      const serialMatch = fullNumber.match(/(\d+)(?!.*\d)/);
      const serialNumber = serialMatch ? Number(serialMatch[1]) : null;
      const numberType = fullNumber.startsWith('QTD-') ? 'QTD' : 'HISTORICAL';

      if (serialNumber === null || Number.isNaN(serialNumber)) {
        errors.push({ line: fullNumber, reason: '无法从编号中提取流水号' });
        continue;
      }

      insertStmt.run(operator, 'Imported', normalizedProjectCode, numberType, serialNumber, fullNumber, ipAddress, documentName);
      imported.push(fullNumber);
    }

    return successResponse(res, { imported, skipped, errors }, '导入完成');
  } catch (error) {
    console.error('Import technical document applications error:', error);
    return errorResponse(res, 500, '导入失败');
  }
}

module.exports = {
  getKeywords,
  createKeyword,
  updateKeyword,
  deleteKeyword,
  importApplications,
};
