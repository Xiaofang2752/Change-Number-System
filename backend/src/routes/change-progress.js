const express = require('express');
const router = express.Router();
const changeProgressController = require('../controllers/changeProgressController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');

// 获取进度列表 (无需管理员登录)
router.get('/', optionalAuthMiddleware, changeProgressController.getChangeProgressList);

// 导出 CSV (开放给工程师，可选认证) — 必须放在 /:id 之前
router.get('/export', optionalAuthMiddleware, changeProgressController.exportCSV);

// 批量导入 (开放给工程师，可选认证) — 必须放在 /:id 之前
router.post('/import', optionalAuthMiddleware, changeProgressController.importChangeProgress);

// 创建进度记录 (需要管理员权限)
router.post('/', authMiddleware, changeProgressController.createChangeProgress);

// 更新进度记录 (需要管理员权限)
router.put('/:id', authMiddleware, changeProgressController.updateChangeProgress);

// 删除进度记录 (需要管理员权限)
router.delete('/:id', authMiddleware, changeProgressController.deleteChangeProgress);

module.exports = router;
