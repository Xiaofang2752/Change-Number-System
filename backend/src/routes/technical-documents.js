const express = require('express');
const router = express.Router();
const technicalDocumentController = require('../controllers/technicalDocumentController');
const { authMiddleware } = require('../middlewares/auth');

// 技术文件关键字管理
router.get('/keywords', technicalDocumentController.getKeywords);
router.post('/keywords', authMiddleware, technicalDocumentController.createKeyword);
router.put('/keywords/:id', authMiddleware, technicalDocumentController.updateKeyword);
router.delete('/keywords/:id', authMiddleware, technicalDocumentController.deleteKeyword);

// 导入现有 QTD 编号
router.post('/import', authMiddleware, technicalDocumentController.importApplications);

module.exports = router;
