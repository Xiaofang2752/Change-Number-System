const express = require('express');
const router = express.Router();
const guideQnaController = require('../controllers/guideQnaController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');

// 前台：获取已发布的问答 (公开)
router.get('/', optionalAuthMiddleware, guideQnaController.getPublishedQna);

// 后台：获取草稿 (管理员)
router.get('/draft', authMiddleware, guideQnaController.getDraftQna);

// 后台：保存草稿 (管理员)
router.put('/draft', authMiddleware, guideQnaController.saveDraftQna);

// 后台：发布 (管理员)
router.post('/publish', authMiddleware, guideQnaController.publishQna);

// 后台：历史列表 (管理员)
router.get('/history', authMiddleware, guideQnaController.getHistoryList);

// 后台：历史详情 (管理员)
router.get('/history/:id', authMiddleware, guideQnaController.getHistoryDetail);

// 后台：删除历史版本 (管理员)
router.delete('/history/:id', authMiddleware, guideQnaController.deleteHistory);

module.exports = router;
