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

/**
 * 批量导入变更进度
 * 请求体: { entries: Array<{ project_code, cr_no, dcp_no, cn_no, change_description,
 *                          affects_regulation, regulation_content, cr_progress, cn_progress }> }
 * 去重维度: cr_no + dcp_no + cn_no 三者组合（任一非空时比对，全空则直接插入）
 */
function importChangeProgress(req, res) {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return errorResponse(res, 400, '请提供要导入的进度记录列表');
    }

    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT INTO change_progress (
        project_code, cr_no, dcp_no, cn_no, change_description,
        affects_regulation, regulation_content, cr_progress, cn_progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const checkDupStmt = db.prepare(
      'SELECT id FROM change_progress WHERE cr_no = ? AND dcp_no = ? AND cn_no = ?'
    );

    const imported = [];
    const skipped = [];
    const errors = [];

    entries.forEach((raw, index) => {
      const line = index + 2; // 第 1 行是表头
      try {
        if (!raw || typeof raw !== 'object') {
          errors.push({ line, reason: '数据格式错误' });
          return;
        }

        const project_code = String(raw.project_code || '').trim();
        const cr_no = String(raw.cr_no || '').trim();
        const dcp_no = String(raw.dcp_no || '').trim();
        const cn_no = String(raw.cn_no || '').trim();
        const change_description = String(raw.change_description || '').trim();

        // affects_regulation 支持 "是/否" 或 1/0 或 true/false
        let affects_regulation = 0;
        const ar = raw.affects_regulation;
        if (typeof ar === 'string') {
          const s = ar.trim();
          affects_regulation = (s === '是' || s === '1' || s.toLowerCase() === 'true') ? 1 : 0;
        } else if (typeof ar === 'number') {
          affects_regulation = ar ? 1 : 0;
        } else if (typeof ar === 'boolean') {
          affects_regulation = ar ? 1 : 0;
        }

        const regulation_content = String(raw.regulation_content || '').trim();
        const cr_progress = String(raw.cr_progress || '').trim();
        const cn_progress = String(raw.cn_progress || '').trim();

        // 全空行跳过
        if (!project_code && !cr_no && !dcp_no && !cn_no && !change_description) {
          skipped.push({ line, reason: '空行' });
          return;
        }

        // 去重：三者组合命中则跳过
        if (cr_no || dcp_no || cn_no) {
          const dup = checkDupStmt.get(cr_no, dcp_no, cn_no);
          if (dup) {
            skipped.push({ line, reason: `CR/DCP/CN 编号组合已存在: ${cr_no || '-'}/${dcp_no || '-'}/${cn_no || '-'}` });
            return;
          }
        }

        insertStmt.run(
          project_code, cr_no, dcp_no, cn_no, change_description,
          affects_regulation, regulation_content, cr_progress, cn_progress
        );
        imported.push({ line, cr_no: cr_no || '-', dcp_no: dcp_no || '-', cn_no: cn_no || '-' });
      } catch (e) {
        errors.push({ line, reason: e.message || '未知错误' });
      }
    });

    return successResponse(res, { imported, skipped, errors }, '导入完成');
  } catch (error) {
    console.error('Import change progress error:', error);
    return errorResponse(res, 500, '导入失败');
  }
}

/**
 * 导出变更进度 CSV
 * 查询参数: ?keyword= 可选，与列表查询一致
 */
function exportCSV(req, res) {
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

    const headers = [
      'ID', '所属项目代号', '项目名称', 'CR No.', 'DCP No.', 'CN No.',
      '变更描述', '是否影响法规', '法规内容', 'CR进度', 'CN进度', '创建时间', '更新时间'
    ];

    const rows = list.map(r => [
      r.id,
      r.project_code || '',
      r.project_name || '',
      r.cr_no || '',
      r.dcp_no || '',
      r.cn_no || '',
      r.change_description || '',
      r.affects_regulation ? '是' : '否',
      r.regulation_content || '',
      r.cr_progress || '',
      r.cn_progress || '',
      r.created_at,
      r.updated_at
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="change_progress_${new Date().toISOString().split('T')[0]}.csv"`);
    return res.status(200).send(BOM + csvContent);
  } catch (error) {
    console.error('Export change progress CSV error:', error);
    return errorResponse(res, 500, '导出 CSV 失败');
  }
}

module.exports = {
  getChangeProgressList,
  createChangeProgress,
  updateChangeProgress,
  deleteChangeProgress,
  importChangeProgress,
  exportCSV,
};
