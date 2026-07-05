const { getDatabase } = require('../db/connection');
const { successResponse, errorResponse } = require('../middlewares/response');
const { computeContentHash } = require('../utils/contentHash');

/**
 * 前台：获取已发布的问答列表 + 最新发布时间
 */
function getPublishedQna(req, res) {
  try {
    const db = getDatabase();
    const list = db.prepare(
      "SELECT id, sort_order, question, answer, updated_at FROM guide_qna WHERE status = 'published' ORDER BY sort_order ASC"
    ).all();

    // 最新发布时间：取 history 最新一条的 published_at；若无历史，取 published 记录的 updated_at
    let lastPublishedAt = null;
    if (list.length > 0) {
      lastPublishedAt = list[0].updated_at;
    }
    const latestHistory = db.prepare(
      'SELECT published_at FROM guide_qna_history ORDER BY published_at DESC LIMIT 1'
    ).get();
    if (latestHistory) {
      lastPublishedAt = latestHistory.published_at;
    }

    return successResponse(res, { items: list, published_at: lastPublishedAt });
  } catch (error) {
    console.error('Get published Q&A error:', error);
    return errorResponse(res, 500, '获取问答列表失败');
  }
}

/**
 * 后台：获取草稿（若草稿为空，自动从 published 复制一份）
 */
function getDraftQna(req, res) {
  try {
    const db = getDatabase();
    let draft = db.prepare(
      "SELECT id, sort_order, question, answer FROM guide_qna WHERE status = 'draft' ORDER BY sort_order ASC"
    ).all();

    if (draft.length === 0) {
      // 从 published 复制一份为草稿
      const published = db.prepare(
        "SELECT sort_order, question, answer FROM guide_qna WHERE status = 'published' ORDER BY sort_order ASC"
      ).all();
      if (published.length > 0) {
        const insert = db.prepare(
          "INSERT INTO guide_qna (sort_order, question, answer, status) VALUES (?, ?, ?, 'draft')"
        );
        const tx = db.transaction(() => {
          published.forEach(p => insert.run(p.sort_order, p.question, p.answer));
        });
        tx();
        draft = db.prepare(
          "SELECT id, sort_order, question, answer FROM guide_qna WHERE status = 'draft' ORDER BY sort_order ASC"
        ).all();
      }
    }

    return successResponse(res, draft);
  } catch (error) {
    console.error('Get draft Q&A error:', error);
    return errorResponse(res, 500, '获取草稿失败');
  }
}

/**
 * 后台：保存草稿（整体替换）
 * 请求体: { items: [{ question, answer, sort_order }, ...] }
 */
function saveDraftQna(req, res) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return errorResponse(res, 400, '请提供问答列表');
    }

    const db = getDatabase();
    const insert = db.prepare(
      "INSERT INTO guide_qna (sort_order, question, answer, status) VALUES (?, ?, ?, 'draft')"
    );
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM guide_qna WHERE status = 'draft'").run();
      items.forEach((it, idx) => {
        const q = (it.question || '').trim();
        const a = (it.answer || '').trim();
        if (!q) return; // 跳过空问题
        insert.run(Number(it.sort_order) || idx + 1, q, a);
      });
    });
    tx();

    const draft = db.prepare(
      "SELECT id, sort_order, question, answer FROM guide_qna WHERE status = 'draft' ORDER BY sort_order ASC"
    ).all();
    return successResponse(res, draft, '草稿已保存');
  } catch (error) {
    console.error('Save draft Q&A error:', error);
    return errorResponse(res, 500, '保存草稿失败');
  }
}

/**
 * 后台：发布
 * 1. 读取 draft，计算 content_hash
 * 2. 与当前 published 的 content_hash 比对，相同则提示无变化（不归档）
 * 3. 不同则：当前 published 归档到 history → 删除旧 published → draft 复制为 published（保留 draft）
 */
function publishQna(req, res) {
  try {
    const db = getDatabase();
    const draft = db.prepare(
      "SELECT sort_order, question, answer FROM guide_qna WHERE status = 'draft' ORDER BY sort_order ASC"
    ).all();

    if (draft.length === 0) {
      return errorResponse(res, 400, '草稿为空，无法发布');
    }

    const newHash = computeContentHash(draft);

    // 读取当前 published
    const published = db.prepare(
      "SELECT sort_order, question, answer FROM guide_qna WHERE status = 'published' ORDER BY sort_order ASC"
    ).all();

    // 与当前 published 比对：相同则不归档
    if (published.length > 0) {
      const oldHash = computeContentHash(published);
      if (oldHash === newHash) {
        return successResponse(res, { published: false, reason: '内容与当前发布版相同，未生成新历史记录' }, '内容无变化');
      }
    }

    const now = new Date();
    const versionLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 发布`;

    const insertHistory = db.prepare(`
      INSERT INTO guide_qna_history (version_label, content_hash, snapshot, published_at, archived_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const deletePublished = db.prepare("DELETE FROM guide_qna WHERE status = 'published'");
    const insertPublished = db.prepare(
      "INSERT INTO guide_qna (sort_order, question, answer, status, updated_at) VALUES (?, ?, ?, 'published', CURRENT_TIMESTAMP)"
    );

    const tx = db.transaction(() => {
      // 归档当前 published（若有）
      if (published.length > 0) {
        const snapshot = JSON.stringify(published.map(p => ({
          question: p.question,
          answer: p.answer,
          sort_order: p.sort_order,
        })));
        const oldHash = computeContentHash(published);
        insertHistory.run(versionLabel, oldHash, snapshot);
      }
      // 替换 published：删旧 + 从 draft 复制为新 published（保留 draft）
      deletePublished.run();
      draft.forEach(d => insertPublished.run(d.sort_order, d.question, d.answer));
    });
    tx();

    return successResponse(res, { published: true, version_label: versionLabel }, '发布成功');
  } catch (error) {
    console.error('Publish Q&A error:', error);
    return errorResponse(res, 500, '发布失败');
  }
}

/**
 * 后台：获取历史版本列表
 */
function getHistoryList(req, res) {
  try {
    const db = getDatabase();
    const list = db.prepare(
      'SELECT id, version_label, content_hash, published_at FROM guide_qna_history ORDER BY published_at DESC'
    ).all();
    const result = list.map(h => ({
      id: h.id,
      version_label: h.version_label,
      content_hash_short: String(h.content_hash).slice(0, 8),
      published_at: h.published_at,
    }));
    return successResponse(res, result);
  } catch (error) {
    console.error('Get history list error:', error);
    return errorResponse(res, 500, '获取历史列表失败');
  }
}

/**
 * 后台：获取某历史版本详情
 */
function getHistoryDetail(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const row = db.prepare(
      'SELECT id, version_label, content_hash, snapshot, published_at FROM guide_qna_history WHERE id = ?'
    ).get(id);
    if (!row) {
      return errorResponse(res, 404, '历史版本不存在');
    }
    let items = [];
    try {
      items = JSON.parse(row.snapshot);
    } catch (e) {
      items = [];
    }
    return successResponse(res, {
      id: row.id,
      version_label: row.version_label,
      content_hash_short: String(row.content_hash).slice(0, 8),
      published_at: row.published_at,
      items,
    });
  } catch (error) {
    console.error('Get history detail error:', error);
    return errorResponse(res, 500, '获取历史详情失败');
  }
}

/**
 * 后台：删除历史版本
 */
function deleteHistory(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const result = db.prepare('DELETE FROM guide_qna_history WHERE id = ?').run(id);
    if (result.changes === 0) {
      return errorResponse(res, 404, '历史版本不存在');
    }
    return successResponse(res, null, '历史版本已删除');
  } catch (error) {
    console.error('Delete history error:', error);
    return errorResponse(res, 500, '删除历史版本失败');
  }
}

module.exports = {
  getPublishedQna,
  getDraftQna,
  saveDraftQna,
  publishQna,
  getHistoryList,
  getHistoryDetail,
  deleteHistory,
};
