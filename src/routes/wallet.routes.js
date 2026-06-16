import express from 'express';
import { getWalletDetails, getWalletTransactions } from '../controllers/wallet.controller.js';
import { authMiddleware as protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', getWalletDetails);
router.get('/transactions', getWalletTransactions);

export default router;
