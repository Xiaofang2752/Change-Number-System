const express = require('express');
const router = express.Router();
const contributorController = require('../controllers/contributorController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');

// 获取贡献者列表 (无权限限制)
router.get('/', optionalAuthMiddleware, contributorController.getContributors);

// 以下操作需要管理员登录权限
router.post('/', authMiddleware, contributorController.createContributor);
router.put('/:id', authMiddleware, contributorController.updateContributor);
router.delete('/:id', authMiddleware, contributorController.deleteContributor);

module.exports = router;
