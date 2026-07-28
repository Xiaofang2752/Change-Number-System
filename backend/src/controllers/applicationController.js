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
 * 技术文件取号类别规则表
 * middleType: 'project' 需要项目代号；'fixed' 使用固定中间段 fixedMiddle；'subcategory' 使用子类型作为中间段
 * subCategory: 存入 sub_category 列，用于展示与部分编号格式
 * serialWidth: 流水号补零宽度
 * serialStart: 流水号起始值（程序类从 1000000 起）
 * serialPrefix: 流水号前缀（程序类为 'S'）
 * serialGroup: 'COMMON' 与多个技术文件类别共用 6 位流水号；'PROGRAM' 程序类单独维护
 */
const CATEGORY_RULES = {
  PRODUCT_TECH:  { numberType: 'QTD',  middleType: 'project',    subCategory: null,   serialWidth: 6, serialStart: 1, serialGroup: 'COMMON' },
  GENERAL_TECH:  { numberType: 'QTD',  middleType: 'fixed',      fixedMiddle: 'CM', subCategory: null,   serialWidth: 6, serialStart: 1, serialGroup: 'COMMON' },
  DHF:           { numberType: 'DHF',  middleType: 'project',    subCategory: null,   serialWidth: 6, serialStart: 1, serialGroup: 'COMMON' },
  SOP:           { numberType: 'SOP',  middleType: 'project',    subCategory: null,   serialWidth: 6, serialStart: 1, serialGroup: 'COMMON' },
  PROGRAM:       { numberType: 'SOFT', middleType: 'project',    subCategory: null,   serialWidth: 7, serialStart: 1000000, serialPrefix: 'S', serialGroup: 'PROGRAM' },
  BOM:           { numberType: 'BOM',  middleType: 'project',    subCategory: null,   serialWidth: 6, serialStart: 1, serialGroup: 'COMMON' },
  BOM_PCBA:      { numberType: 'BOM',  middleType: 'subcategory', subCategory: 'PCBA', serialWidth: 6, serialStart: 1, serialGroup: 'COMMON' },
  OTHER_DRAWING: { numberType: 'DRW',  middleType: 'fixed',      fixedMiddle: 'CM', subCategory: null,   serialWidth: 6, serialStart: 1, serialGroup: 'COMMON' },
};

/**
 * 记录表单可派生的源文件类别（产品技术文件 / 通用技术 / DHF / SOP）
 */
const RECORD_FORM_SOURCE_TYPES = ['PRODUCT_TECH', 'GENERAL_TECH', 'DHF', 'SOP'];

/**
 * 按规则生成流水号
 * COMMON 组跨 QTD/DHF/SOP/BOM/DRW 等 number_type 共用最大流水号；PROGRAM 组仅 SOFT 自增。
 */
function generateSerialNumberByRule(db, rule) {
  const serialGroup = rule.serialGroup;
  const serialStart = rule.serialStart;

  if (serialGroup === 'COMMON') {
    const commonTypes = ['QTD', 'DHF', 'SOP', 'BOM', 'DRW'];
    const placeholders = commonTypes.map(() => '?').join(',');
    const result = db.prepare(
      `SELECT MAX(serial_number) as maxSerial FROM applications
       WHERE number_type IN (${placeholders})`
    ).get(...commonTypes);
    return Math.max((result.maxSerial || 0) + 1, serialStart);
  }

  if (serialGroup === 'PROGRAM') {
    const result = db.prepare(
      `SELECT MAX(serial_number) as maxSerial FROM applications
       WHERE number_type = ?`
    ).get('SOFT');
    return Math.max((result.maxSerial || 0) + 1, serialStart);
  }

  return serialStart;
}

/**
 * 生成流水号：按 (number_type, project_code, sub_category) 三字段分组取 MAX+1（旧路径兼容）
 */
function generateSerialNumber(db, numberType, projectCode, subCategory) {
  const result = db.prepare(
    `SELECT MAX(serial_number) as maxSerial FROM applications
     WHERE number_type = ? AND project_code = ? AND COALESCE(sub_category, '') = COALESCE(?, '')`
  ).get(numberType, projectCode, subCategory || null);

  const nextSerial = (result.maxSerial || 0) + 1;
  return nextSerial;
}

/**
 * 按规则格式化流水号
 */
function formatSerialByRule(serial, rule) {
  const padded = String(serial).padStart(rule.serialWidth, '0');
  return rule.serialPrefix ? `${rule.serialPrefix}${padded}` : padded;
}

/**
 * 格式化流水号（旧路径兼容：变更管理表单 TD/CR/DCP/CN/QTD）
 */
function formatSerialNumberLegacy(serial, numberType, projectCode) {
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
    const { applicant_name, document_name = '', project_code = '', number_type, category, applicant_type, capToken, source_number } = req.body;

    if (!applicant_name) {
      return errorResponse(res, 400, '申请人不能为空');
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

    // ===== 技术文件取号：基于 category =====
    let rule = null;
    let isRecordForm = false;
    let finalNumberType = number_type;
    let finalProjectCode = project_code;
    let finalSubCategory = null;
    let finalCategory = null;
    let finalSourceNumber = null;
    let serialNumber;
    let fullNumber;

    if (category === 'RECORD_FORM') {
      // ===== 记录表单：从已存在的源文件编号派生 {源文件编号}-R{nnn} =====
      isRecordForm = true;

      if (!document_name.trim()) {
        return errorResponse(res, 400, '文档名称不能为空');
      }
      if (!source_number || !source_number.trim()) {
        return errorResponse(res, 400, '请填写源文件编号');
      }

      const sourceFullNumber = source_number.trim();
      const source = db.prepare(
        'SELECT * FROM applications WHERE full_number = ?'
      ).get(sourceFullNumber);
      if (!source) {
        return errorResponse(res, 400, '源文件编号不存在');
      }

      const sourceCategory = source.category;
      if (!RECORD_FORM_SOURCE_TYPES.includes(sourceCategory)) {
        return errorResponse(res, 400, '该文件类别不支持引出记录表单（仅支持产品技术文件 / 通用技术 / DHF / SOP）');
      }

      // 同一源文件的记录表单按 R001、R002… 递增
      const maxRow = db.prepare(
        'SELECT MAX(serial_number) AS maxSerial FROM applications WHERE source_number = ? AND category = ?'
      ).get(sourceFullNumber, 'RECORD_FORM');
      const nextSerial = (maxRow.maxSerial || 0) + 1;

      serialNumber = nextSerial;
      finalCategory = 'RECORD_FORM';
      finalNumberType = source.number_type;
      finalProjectCode = source.project_code;
      finalSubCategory = null;
      finalSourceNumber = sourceFullNumber;
      fullNumber = `${sourceFullNumber}-R${String(nextSerial).padStart(3, '0')}`;

    } else if (category) {
      rule = CATEGORY_RULES[category];
      if (!rule) {
        return errorResponse(res, 400, '编号类别不存在');
      }
      finalCategory = category;
      finalNumberType = rule.numberType;
      finalSubCategory = rule.subCategory;

      if (!document_name.trim()) {
        return errorResponse(res, 400, '文档名称不能为空');
      }

      if (rule.middleType === 'fixed') {
        // 固定中间段（通用技术 CM / 其他图纸 CM），不校验项目
        finalProjectCode = rule.fixedMiddle;
      } else {
        // 项目类及子类型中间段（project / subcategory）均需项目代号，但 subcategory 格式不显示项目代号
        if (!project_code || !project_code.trim()) {
          return errorResponse(res, 400, '项目代号不能为空');
        }
        finalProjectCode = project_code.trim();

        const project = db.prepare(
          'SELECT * FROM projects WHERE code = ? AND status IN (?, ?)'
        ).get(finalProjectCode, 'approved', 'pending');
        if (!project) {
          const rejectedProject = db.prepare(
            'SELECT * FROM projects WHERE code = ? AND status = ?'
          ).get(finalProjectCode, 'rejected');
          if (rejectedProject) {
            return errorResponse(res, 400, '该项目代号未通过审核，无法提交申请');
          }
          return errorResponse(res, 400, '项目代号不存在');
        }
      }
      // category 路径跳过 number_types 表存在性校验（类别即权威来源）

    } else {
      // ===== 旧路径：变更管理表单 TD/CR/DCP/CN/QTD =====
      if (!number_type) {
        return errorResponse(res, 400, '编号类型不能为空');
      }

      if (number_type === 'QTD' && !document_name.trim()) {
        return errorResponse(res, 400, '文档名称不能为空');
      }

      if (number_type !== 'QTD' && !project_code) {
        return errorResponse(res, 400, '项目代号不能为空');
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
        const rejectedNumberType = db.prepare(
          'SELECT * FROM number_types WHERE type_code = ? AND status = ?'
        ).get(number_type, 'rejected');
        if (rejectedNumberType) {
          return errorResponse(res, 400, '该编号类型未通过审核，无法提交申请');
        }
        return errorResponse(res, 400, '编号类型不存在');
      }
    }

    // 生成流水号与完整编号
    let formattedSerial;

    if (isRecordForm) {
      // 记录表单的 serialNumber / fullNumber 已在 RECORD_FORM 分支内计算完成
    } else if (rule) {
      serialNumber = generateSerialNumberByRule(db, rule);
      formattedSerial = formatSerialByRule(serialNumber, rule);
      if (rule.middleType === 'fixed') {
        fullNumber = `${finalNumberType}-${rule.fixedMiddle}-${formattedSerial}`;
      } else if (rule.middleType === 'subcategory') {
        // 子类型作为中间段，不显示项目代号，如 BOM-PCBA-000001
        fullNumber = `${finalNumberType}-${finalSubCategory}-${formattedSerial}`;
      } else if (finalSubCategory) {
        // BOM 旧兼容：四段 BOM-{子类型}-{项目}-{流水号}
        fullNumber = `${finalNumberType}-${finalSubCategory}-${finalProjectCode}-${formattedSerial}`;
      } else {
        fullNumber = `${finalNumberType}-${finalProjectCode}-${formattedSerial}`;
      }
    } else {
      serialNumber = generateSerialNumber(db, number_type, project_code, null);
      formattedSerial = formatSerialNumberLegacy(serialNumber, number_type, project_code);
      fullNumber = number_type === 'QTD' && !project_code
        ? `${number_type}-${formattedSerial}`
        : `${number_type}-${project_code}-${formattedSerial}`;
    }

    // 获取 IP
    const ipAddress = getClientIP(req);

    // 插入记录
    const result = db.prepare(
      'INSERT INTO applications (applicant_name, applicant_type, document_name, project_code, number_type, serial_number, full_number, ip_address, category, sub_category, source_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(applicant_name, applicant_type || '', document_name || '', finalProjectCode, finalNumberType, serialNumber, fullNumber, ipAddress, finalCategory, finalSubCategory, finalSourceNumber);

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
    const { page = 1, limit = 10, keyword, project_code, number_type, category, exclude_type, start_date, end_date, applicant_type, applicant_name, ip_address, sort_by, sort_order } = req.query;
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

    // 类别过滤（支持逗号分隔的多个类别；BOM 兼容旧子类型 BOM_ASSE / BOM_SOFT）
    if (category) {
      let catList = category.split(',').map(c => c.trim()).filter(Boolean);
      catList = catList.flatMap(c => c === 'BOM' ? ['BOM', 'BOM_ASSE', 'BOM_SOFT'] : [c]);
      if (catList.length > 0) {
        const placeholders = catList.map(() => '?').join(', ');
        whereClauses.push(`LOWER(COALESCE(category, '')) IN (${placeholders})`);
        params.push(...catList.map(c => c.toLowerCase()));
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
 * 更新申请记录（目前仅允许修改文档名称）
 */
function updateApplication(req, res) {
  try {
    const { id } = req.params;
    const { document_name } = req.body;
    const db = getDatabase();

    const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    if (!existing) {
      return errorResponse(res, 404, '申请记录不存在');
    }

    // 仅允许更新 document_name；其余字段保持不变
    db.prepare('UPDATE applications SET document_name = ? WHERE id = ?').run(
      document_name === undefined ? existing.document_name : document_name,
      id
    );

    const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    return successResponse(res, updated, '更新成功');
  } catch (error) {
    console.error('Update application error:', error);
    return errorResponse(res, 500, '更新申请记录失败');
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
    const headers = ['ID', '申请人', '文档名称', '申请人类型', '项目代号', '编号类型', '类别', '子类别', '流水号', '完整编号', '源文件编号', 'IP 地址', '申请时间'];

    // CSV 内容
    const rows = applications.map(app => [
      app.id,
      app.applicant_name,
      app.document_name || '',
      app.applicant_type || '',
      app.project_code,
      app.number_type,
      app.category || '',
      app.sub_category || '',
      app.serial_number,
      app.full_number,
      app.source_number || '',
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
  updateApplication,
  deleteApplication,
  batchDeleteApplications,
  exportCSV,
  setCooldownSeconds,
  getCooldownSeconds,
};
