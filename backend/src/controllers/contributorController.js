const { getDatabase } = require('../db/connection');
const { successResponse, errorResponse } = require('../middlewares/response');

/**
 * 获取贡献者列表 (按积分降序排序，积分相同按创建时间升序)
 */
function getContributors(req, res) {
  try {
    const db = getDatabase();
    const list = db.prepare('SELECT * FROM contributors ORDER BY points DESC, created_at ASC').all();
    return successResponse(res, list);
  } catch (error) {
    console.error('Get contributors error:', error);
    return errorResponse(res, 500, '获取贡献者列表失败');
  }
}

/**
 * 创建贡献者 (管理员权限)
 */
function createContributor(req, res) {
  try {
    const { name, points = 0, description = '' } = req.body;

    if (!name || !name.trim()) {
      return errorResponse(res, 400, '贡献者姓名不能为空');
    }

    const db = getDatabase();
    
    // 检查重名
    const existing = db.prepare('SELECT id FROM contributors WHERE name = ?').get(name.trim());
    if (existing) {
      return errorResponse(res, 400, '该贡献者姓名已存在');
    }

    const result = db.prepare(`
      INSERT INTO contributors (name, points, description)
      VALUES (?, ?, ?)
    `).run(name.trim(), Number(points) || 0, description || '');

    const created = db.prepare('SELECT * FROM contributors WHERE id = ?').get(result.lastInsertRowid);
    return successResponse(res, created, '添加贡献者成功');
  } catch (error) {
    console.error('Create contributor error:', error);
    return errorResponse(res, 500, '添加贡献者失败');
  }
}

/**
 * 更新贡献者 (管理员权限)
 */
function updateContributor(req, res) {
  try {
    const { id } = req.params;
    const { name, points, description } = req.body;

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM contributors WHERE id = ?').get(id);

    if (!existing) {
      return errorResponse(res, 404, '该贡献者不存在');
    }

    let finalName = existing.name;
    if (name !== undefined) {
      finalName = name.trim();
      if (!finalName) {
        return errorResponse(res, 400, '贡献者姓名不能为空');
      }
      // 检查是否与其他记录重名
      const duplicate = db.prepare('SELECT id FROM contributors WHERE name = ? AND id != ?').get(finalName, id);
      if (duplicate) {
        return errorResponse(res, 400, '该贡献者姓名已与其他贡献者重复');
      }
    }

    db.prepare(`
      UPDATE contributors SET
        name = ?,
        points = ?,
        description = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      finalName,
      points !== undefined ? Number(points) : existing.points,
      description !== undefined ? description : existing.description,
      id
    );

    const updated = db.prepare('SELECT * FROM contributors WHERE id = ?').get(id);
    return successResponse(res, updated, '更新贡献者成功');
  } catch (error) {
    console.error('Update contributor error:', error);
    return errorResponse(res, 500, '更新贡献者失败');
  }
}

/**
 * 删除贡献者 (管理员权限)
 */
function deleteContributor(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const result = db.prepare('DELETE FROM contributors WHERE id = ?').run(id);
    if (result.changes === 0) {
      return errorResponse(res, 404, '贡献者不存在');
    }

    return successResponse(res, null, '删除贡献者成功');
  } catch (error) {
    console.error('Delete contributor error:', error);
    return errorResponse(res, 500, '删除贡献者失败');
  }
}

module.exports = {
  getContributors,
  createContributor,
  updateContributor,
  deleteContributor,
};
