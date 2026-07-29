const express = require('express');
const router = express.Router();
const dcpController = require('../controllers/dcpController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// 管理员上传 / 查看模板元信息（注意：/template 需在 /:id 之前注册）
router.post('/template', authMiddleware, upload.single('file'), dcpController.uploadTemplate);
router.get('/template', authMiddleware, dcpController.getTemplateMeta);

// 按申请 id 生成并下载已填充的 DCP 文档（供所有用户使用）
router.get('/:id', optionalAuthMiddleware, dcpController.downloadFilled);

module.exports = router;
