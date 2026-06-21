const express = require('express');
const router = express.Router();
const changeProgressController = require('../controllers/changeProgressController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');

// 获取进度列表 (无需管理员登录)
router.get('/', optionalAuthMiddleware, changeProgressController.getChangeProgressList);

// 创建进度记录 (需要管理员权限)
router.post('/', authMiddleware, changeProgressController.createChangeProgress);

// 更新进度记录 (需要管理员权限)
router.put('/:id', authMiddleware, changeProgressController.updateChangeProgress);

// 删除进度记录 (需要管理员权限)
router.delete('/:id', authMiddleware, changeProgressController.deleteChangeProgress);

module.exports = router;
