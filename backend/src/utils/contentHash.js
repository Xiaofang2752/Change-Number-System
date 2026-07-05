const crypto = require('crypto');

/**
 * 计算问答内容的稳定哈希（用于历史版本去重比对）
 * @param {Array<{question: string, answer: string, sort_order: number}>} items
 * @returns {string} SHA256 十六进制摘要
 */
function computeContentHash(items) {
  // 稳定排序：按 sort_order 升序，相同则按 question
  const sorted = [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (a.question || '').localeCompare(b.question || '');
  });
  // 标准化字符串：trim + 去除首尾空白行
  const normalized = sorted.map(it => ({
    q: (it.question || '').trim(),
    a: (it.answer || '').trim(),
    s: Number(it.sort_order) || 0,
  }));
  const json = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(json, 'utf8').digest('hex');
}

module.exports = { computeContentHash };
