const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const applicationController = require('../controllers/applicationController');
const { authMiddleware } = require('../middlewares/auth');

// 管理员登录
router.post('/login', adminController.login);

// 管理员登出 (需要认证)
router.post('/logout', authMiddleware, adminController.logout);

// 修改管理员密码 (需要认证)
router.post('/change-password', authMiddleware, adminController.changePassword);

// 批量删除申请记录 (需要认证)
router.delete('/applications/batch', authMiddleware, applicationController.batchDeleteApplications);

// 删除单条申请记录 (需要认证)
router.delete('/applications/:id', authMiddleware, applicationController.deleteApplication);

module.exports = router;
