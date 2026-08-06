const express = require('express');
const router = express.Router();
const dcpController = require('../controllers/dcpController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// 管理员上传 / 查看文档模板（按 ?type=DCP|IMPACT|RISK 区分类型）
// 注意：/doc-template 需在 /:id 之前注册
router.post('/doc-template', authMiddleware, upload.single('file'), dcpController.uploadDocTemplate);
router.get('/doc-template', authMiddleware, dcpController.getDocTemplateMeta);

// 工程师按申请 id 下载已填充文档（按类型对应模板版本）：/doc/:type/:id
router.get('/doc/:type/:id', optionalAuthMiddleware, dcpController.downloadDoc);

// 兼容旧 DCP 下载入口：/dcp/:id
router.get('/:id', optionalAuthMiddleware, dcpController.downloadDcp);

module.exports = router;
