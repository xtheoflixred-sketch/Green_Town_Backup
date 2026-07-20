import { Router } from 'express';
import { getMockAccounts, createMockAccount } from '../api/mock-login';

const router = Router();

router.get('/accounts', getMockAccounts);
router.post('/create', createMockAccount);

export default router;
