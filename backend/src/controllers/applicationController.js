const { getDatabase } = require('../db/connection');
const { successResponse, errorResponse } = require('../middlewares/response');
const { getClientIP } = require('../utils/ip');

// 取号冷却时间（秒），管理员可配置
let COOLDOWN_SECONDS = 10;

/**
 * 设置冷却时间（管理员配置）
 */
function setCooldownSeconds(seconds) {
  if (seconds >= 5 && seconds <= 60) {
    COOLDOWN_SECONDS = seconds;
  }
}

/**
 * 获取冷却时间
 */
function getCooldownSeconds() {
  return COOLDOWN_SECONDS;
}

/**
 * 生成流水号
 */
function generateSerialNumber(db, numberType, projectCode) {
  const result = db.prepare(
    'SELECT MAX(serial_number) as maxSerial FROM applications WHERE number_type = ? AND project_code = ?'
  ).get(numberType, projectCode);

  const nextSerial = (result.maxSerial || 0) + 1;
  return nextSerial;
}

/**
 * 格式化流水号
 */
function formatSerialNumber(serial, numberType, projectCode) {
  if (numberType === 'QTD') {
    const width = projectCode ? 4 : 6;
    return String(serial).padStart(width, '0');
  }
  return String(serial).padStart(4, '0');
}

/**
 * 提交申请
 */
async function createApplication(req, res) {
  try {
    const { applicant_name, document_name = '', project_code = '', number_type, applicant_type, capToken } = req.body;

    if (!applicant_name || !number_type) {
      return errorResponse(res, 400, '申请人和编号类型不能为空');
    }

    if (number_type === 'QTD' && !document_name.trim()) {
      return errorResponse(res, 400, '文档名称不能为空');
    }

    if (number_type !== 'QTD' && !project_code) {
      return errorResponse(res, 400, '项目代号不能为空');
    }

    // 人机验证（如果提供了 capToken）
    if (capToken) {
      const cap = require('../cap');
      const { success } = await cap.validateToken(capToken, { keepToken: false });
      if (!success) {
        return errorResponse(res, 400, '人机验证失败，请重新验证');
      }
    }

    const db = getDatabase();

    // 取号频率检查（基于 IP）
    const clientIP = getClientIP(req);
    const cooldownWindow = getCooldownSeconds();
    const recentApplication = db.prepare(
      'SELECT created_at FROM applications WHERE ip_address = ? ORDER BY created_at DESC LIMIT 1'
    ).get(clientIP);

    if (recentApplication) {
      const lastSubmitTime = new Date(recentApplication.created_at).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - lastSubmitTime) / 1000;

      if (elapsedSeconds < cooldownWindow) {
        const remaining = Math.ceil(cooldownWindow - elapsedSeconds);
        return errorResponse(res, 429, `请求过于频繁，请等待 ${remaining} 秒后再次取号`, { retryAfter: remaining });
      }
    }

    // 验证项目代号 / QTD 关键字是否存在
    if (number_type === 'QTD') {
      if (project_code) {
        const validProject = db.prepare(
          'SELECT * FROM projects WHERE code = ? AND status IN (?, ?)'
        ).get(project_code, 'approved', 'pending');
        const validKeyword = db.prepare(
          'SELECT * FROM technical_document_keywords WHERE keyword = ? AND status IN (?, ?)'
        ).get(project_code, 'approved', 'pending');

        if (!validProject && !validKeyword) {
          const rejectedProject = db.prepare(
            'SELECT * FROM projects WHERE code = ? AND status = ?'
          ).get(project_code, 'rejected');
          if (rejectedProject) {
            return errorResponse(res, 400, '该项目代号未通过审核，无法提交申请');
          }

          const rejectedKeyword = db.prepare(
            'SELECT * FROM technical_document_keywords WHERE keyword = ? AND status = ?'
          ).get(project_code, 'rejected');
          if (rejectedKeyword) {
            return errorResponse(res, 400, '该 QTD 关键字未通过审核，无法提交申请');
          }

          return errorResponse(res, 400, 'QTD 关键字不存在');
        }
      }
    } else {
      const project = db.prepare(
        'SELECT * FROM projects WHERE code = ? AND status IN (?, ?)'
      ).get(project_code, 'approved', 'pending');
      if (!project) {
        const rejectedProject = db.prepare(
          'SELECT * FROM projects WHERE code = ? AND status = ?'
        ).get(project_code, 'rejected');
        if (rejectedProject) {
          return errorResponse(res, 400, '该项目代号未通过审核，无法提交申请');
        }
        return errorResponse(res, 400, '项目代号不存在');
      }
    }

    // 验证编号类型是否存在（允许 approved 和 pending 状态）
    const numberType = db.prepare(
      'SELECT * FROM number_types WHERE type_code = ? AND status IN (?, ?)'
    ).get(number_type, 'approved', 'pending');
    if (!numberType) {
      // 检查是否是 rejected 状态
      const rejectedNumberType = db.prepare(
        'SELECT * FROM number_types WHERE type_code = ? AND status = ?'
      ).get(number_type, 'rejected');
      if (rejectedNumberType) {
        return errorResponse(res, 400, '该编号类型未通过审核，无法提交申请');
      }
      return errorResponse(res, 400, '编号类型不存在');
    }

    // 生成流水号
    const serialNumber = generateSerialNumber(db, number_type, project_code);
    const formattedSerial = formatSerialNumber(serialNumber, number_type, project_code);
    const fullNumber = number_type === 'QTD' && !project_code
      ? `${number_type}-${formattedSerial}`
      : `${number_type}-${project_code}-${formattedSerial}`;

    // 获取 IP
    const ipAddress = getClientIP(req);

    // 插入记录
    const result = db.prepare(
      'INSERT INTO applications (applicant_name, applicant_type, document_name, project_code, number_type, serial_number, full_number, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)' 
    ).run(applicant_name, applicant_type || '', document_name || '', project_code, number_type, serialNumber, fullNumber, ipAddress);

    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);
    return successResponse(res, application, '申请成功');
  } catch (error) {
    console.error('Create application error:', error);
    return errorResponse(res, 500, '提交申请失败');
  }
}

/**
 * 获取申请列表
 */
function getApplications(req, res) {
  try {
    const { page = 1, limit = 10, keyword, project_code, number_type, exclude_type, start_date, end_date, applicant_type, applicant_name, ip_address, sort_by, sort_order } = req.query;
    const db = getDatabase();

    // 排序字段白名单校验
    const ALLOWED_SORT_FIELDS = ['created_at', 'full_number', 'applicant_name'];
    const ALLOWED_SORT_ORDERS = ['ASC', 'DESC'];

    let orderBy = 'created_at'; // 默认排序字段
    let orderDirection = 'DESC'; // 默认排序方向

    if (sort_by) {
      if (!ALLOWED_SORT_FIELDS.includes(sort_by)) {
        return errorResponse(res, 400, `无效的排序字段，允许的字段为: ${ALLOWED_SORT_FIELDS.join(', ')}`);
      }
      orderBy = sort_by;
    }

    if (sort_order) {
      const upperOrder = sort_order.toUpperCase();
      if (!ALLOWED_SORT_ORDERS.includes(upperOrder)) {
        return errorResponse(res, 400, `无效的排序方向，允许的方向为: ${ALLOWED_SORT_ORDERS.join(', ')}`);
      }
      orderDirection = upperOrder;
    }

    let query = 'SELECT * FROM applications';
    const whereClauses = [];
    const params = [];

    // 申请人姓名过滤（模糊匹配，忽略大小写，对所有用户一致）
    if (applicant_name) {
      whereClauses.push('LOWER(applicant_name) LIKE LOWER(?)');
      params.push(`%${applicant_name}%`);
    }

    // 关键字搜索
    if (keyword) {
      whereClauses.push('(applicant_name LIKE ? OR project_code LIKE ? OR full_number LIKE ? OR document_name LIKE ?)');
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam, keywordParam, keywordParam);
    }

    // 项目代号过滤（模糊匹配，忽略大小写）
    if (project_code) {
      whereClauses.push('LOWER(project_code) LIKE LOWER(?)');
      params.push(`%${project_code}%`);
    }

    // 编号类型过滤（支持逗号分隔的多个类型，或者单个类型的模糊匹配）
    if (number_type) {
      if (number_type.includes(',')) {
        const typeList = number_type.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        if (typeList.length > 0) {
          const placeholders = typeList.map(() => '?').join(', ');
          whereClauses.push(`LOWER(number_type) IN (${placeholders})`);
          params.push(...typeList);
        }
      } else {
        whereClauses.push('LOWER(number_type) LIKE LOWER(?)');
        params.push(`%${number_type}%`);
      }
    }

    // 编号类型排除过滤（支持逗号分隔的多个类型，或者单个类型的排除）
    if (exclude_type) {
      if (exclude_type.includes(',')) {
        const excludeTypes = exclude_type.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        if (excludeTypes.length > 0) {
          const placeholders = excludeTypes.map(() => '?').join(', ');
          whereClauses.push(`LOWER(number_type) NOT IN (${placeholders})`);
          params.push(...excludeTypes);
        }
      } else {
        whereClauses.push('LOWER(number_type) != LOWER(?)');
        params.push(exclude_type);
      }
    }

    // 申请人类型过滤（模糊匹配，忽略大小写）
    if (applicant_type) {
      whereClauses.push('LOWER(applicant_type) LIKE LOWER(?)');
      params.push(`%${applicant_type}%`);
    }

    // IP 地址过滤（仅管理员）
    if (ip_address && req.isAdmin) {
      whereClauses.push('ip_address LIKE ?');
      params.push(`%${ip_address}%`);
    }

    // 日期范围过滤
    if (start_date) {
      whereClauses.push('created_at >= ?');
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push('created_at <= ?');
      params.push(end_date);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countQuery).all(...params)[0];

    // 分页
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` ORDER BY ${orderBy} ${orderDirection} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const applications = db.prepare(query).all(...params);

    // 非管理员过滤 IP 字段
    const filteredApps = applications.map(app => {
      if (!req.isAdmin) {
        delete app.ip_address;
      }
      return app;
    });

    return successResponse(res, {
      data: filteredApps,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get applications error:', error);
    return errorResponse(res, 500, '获取申请列表失败');
  }
}

/**
 * 获取统计数据
 */
function getStats(req, res) {
  try {
    const db = getDatabase();

    const totalApplications = db.prepare('SELECT COUNT(*) as total FROM applications').get();
    
    const statsByType = db.prepare(
      'SELECT number_type, COUNT(*) as count FROM applications GROUP BY number_type'
    ).all();

    const statsByProject = db.prepare(
      'SELECT project_code, COUNT(*) as count FROM applications GROUP BY project_code'
    ).all();

    return successResponse(res, {
      total: totalApplications.total,
      byType: statsByType,
      byProject: statsByProject,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return errorResponse(res, 500, '获取统计数据失败');
  }
}

/**
 * 删除单条申请 (管理员)
 */
function deleteApplication(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const result = db.prepare('DELETE FROM applications WHERE id = ?').run(id);

    if (result.changes === 0) {
      return errorResponse(res, 404, '申请记录不存在');
    }

    return successResponse(res, null, '申请记录删除成功');
  } catch (error) {
    console.error('Delete application error:', error);
    return errorResponse(res, 500, '删除申请记录失败');
  }
}

/**
 * 批量删除申请 (管理员)
 */
function batchDeleteApplications(req, res) {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 400, '请提供要删除的 ID 数组');
    }

    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM applications WHERE id IN (${placeholders})`).run(...ids);

    return successResponse(res, { deleted: result.changes }, `成功删除 ${result.changes} 条记录`);
  } catch (error) {
    console.error('Batch delete applications error:', error);
    return errorResponse(res, 500, '批量删除申请记录失败');
  }
}

/**
 * 导出 CSV (管理员)
 */
function exportCSV(req, res) {
  try {
    const db = getDatabase();
    const applications = db.prepare('SELECT * FROM applications ORDER BY created_at DESC').all();

    // CSV 头部
    const headers = ['ID', '申请人', '文档名称', '申请人类型', '项目代号', '编号类型', '流水号', '完整编号', 'IP 地址', '申请时间'];
    
    // CSV 内容
    const rows = applications.map(app => [
      app.id,
      app.applicant_name,
      app.document_name || '',
      app.applicant_type || '',
      app.project_code,
      app.number_type,
      app.serial_number,
      app.full_number,
      app.ip_address || '',
      app.created_at,
    ]);

    // 构建 CSV 字符串
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // UTF-8 BOM
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="applications_${new Date().toISOString().split('T')[0]}.csv"`);
    return res.status(200).send(csvWithBOM);
  } catch (error) {
    console.error('Export CSV error:', error);
    return errorResponse(res, 500, '导出 CSV 失败');
  }
}

module.exports = {
  createApplication,
  getApplications,
  getStats,
  deleteApplication,
  batchDeleteApplications,
  exportCSV,
  setCooldownSeconds,
  getCooldownSeconds,
};
