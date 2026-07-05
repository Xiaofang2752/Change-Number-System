const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');

// 提交申请
router.post('/', applicationController.createApplication);

// 获取申请列表 (支持可选认证)
router.get('/', optionalAuthMiddleware, applicationController.getApplications);

// 获取统计数据
router.get('/stats', applicationController.getStats);

// 导出 CSV (需要管理员权限)
router.get('/export', authMiddleware, applicationController.exportCSV);

// 更新单条申请（目前仅允许修改文档名称）
router.put('/:id', applicationController.updateApplication);

// 删除单条申请 (需要管理员权限)
router.delete('/:id', authMiddleware, applicationController.deleteApplication);

// 批量删除申请 (需要管理员权限)
router.delete('/', authMiddleware, applicationController.batchDeleteApplications);

module.exports = router;
