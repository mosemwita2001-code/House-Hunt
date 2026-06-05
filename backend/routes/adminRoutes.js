import express from 'express';
import { getMetrics, getAdminProperties } from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/metrics', protect, authorize('admin'), getMetrics);
router.get('/properties', protect, authorize('admin'), getAdminProperties);

export default router;
