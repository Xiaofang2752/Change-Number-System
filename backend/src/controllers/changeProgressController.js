const { getDatabase } = require('../db/connection');
const { successResponse, errorResponse } = require('../middlewares/response');

/**
 * 获取变更进度列表
 */
function getChangeProgressList(req, res) {
  try {
    const { keyword } = req.query;
    const db = getDatabase();

    let query = `
      SELECT cp.*, p.name AS project_name 
      FROM change_progress cp 
      LEFT JOIN projects p ON cp.project_code = p.code
    `;
    const params = [];

    if (keyword) {
      query += ' WHERE cp.cr_no LIKE ? OR cp.dcp_no LIKE ? OR cp.cn_no LIKE ? OR cp.change_description LIKE ? OR cp.regulation_content LIKE ? OR cp.project_code LIKE ? OR p.name LIKE ?';
      const searchParam = `%${keyword}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY cp.created_at DESC';

    const list = db.prepare(query).all(...params);
    return successResponse(res, list);
  } catch (error) {
    console.error('Get change progress error:', error);
    return errorResponse(res, 500, '获取变更进度列表失败');
  }
}

/**
 * 创建变更进度记录
 */
function createChangeProgress(req, res) {
  try {
    const {
      project_code,
      cr_no,
      dcp_no,
      cn_no,
      change_description,
      affects_regulation,
      regulation_content,
      cr_progress,
      cn_progress
    } = req.body;

    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO change_progress (
        project_code,
        cr_no,
        dcp_no,
        cn_no,
        change_description,
        affects_regulation,
        regulation_content,
        cr_progress,
        cn_progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_code || '',
      cr_no || '',
      dcp_no || '',
      cn_no || '',
      change_description || '',
      Number(affects_regulation) || 0,
      regulation_content || '',
      cr_progress || '',
      cn_progress || ''
    );

    const created = db.prepare('SELECT * FROM change_progress WHERE id = ?').get(result.lastInsertRowid);
    return successResponse(res, created, '创建变更进度成功');
  } catch (error) {
    console.error('Create change progress error:', error);
    return errorResponse(res, 500, '创建变更进度失败');
  }
}

/**
 * 更新变更进度记录
 */
function updateChangeProgress(req, res) {
  try {
    const { id } = req.params;
    const {
      project_code,
      cr_no,
      dcp_no,
      cn_no,
      change_description,
      affects_regulation,
      regulation_content,
      cr_progress,
      cn_progress
    } = req.body;

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM change_progress WHERE id = ?').get(id);

    if (!existing) {
      return errorResponse(res, 404, '记录不存在');
    }

    db.prepare(`
      UPDATE change_progress SET
        project_code = ?,
        cr_no = ?,
        dcp_no = ?,
        cn_no = ?,
        change_description = ?,
        affects_regulation = ?,
        regulation_content = ?,
        cr_progress = ?,
        cn_progress = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      project_code !== undefined ? project_code : existing.project_code,
      cr_no !== undefined ? cr_no : existing.cr_no,
      dcp_no !== undefined ? dcp_no : existing.dcp_no,
      cn_no !== undefined ? cn_no : existing.cn_no,
      change_description !== undefined ? change_description : existing.change_description,
      affects_regulation !== undefined ? Number(affects_regulation) : existing.affects_regulation,
      regulation_content !== undefined ? regulation_content : existing.regulation_content,
      cr_progress !== undefined ? cr_progress : existing.cr_progress,
      cn_progress !== undefined ? cn_progress : existing.cn_progress,
      id
    );

    const updated = db.prepare('SELECT * FROM change_progress WHERE id = ?').get(id);
    return successResponse(res, updated, '更新变更进度成功');
  } catch (error) {
    console.error('Update change progress error:', error);
    return errorResponse(res, 500, '更新变更进度失败');
  }
}

/**
 * 删除变更进度记录
 */
function deleteChangeProgress(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const result = db.prepare('DELETE FROM change_progress WHERE id = ?').run(id);
    if (result.changes === 0) {
      return errorResponse(res, 404, '记录不存在');
    }

    return successResponse(res, null, '删除变更进度成功');
  } catch (error) {
    console.error('Delete change progress error:', error);
    return errorResponse(res, 500, '删除变更进度失败');
  }
}

module.exports = {
  getChangeProgressList,
  createChangeProgress,
  updateChangeProgress,
  deleteChangeProgress,
};
