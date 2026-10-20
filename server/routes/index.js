import { Router } from 'express';
import adminRoutes from './adminRoutes.js';
import authRoutes from './authRoutes.js';
import publicRoutes from './publicRoutes.js';

/** Version 1 of the REST API, mounted at /api/v1. */
const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/', publicRoutes);

export default router;
