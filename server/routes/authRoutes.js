import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { loginLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, loginSchema } from '../validators/adminValidators.js';

const router = Router();

router.get('/csrf', auth.csrf);
router.post('/login', loginLimiter, verifyCsrf, validate({ body: loginSchema }), auth.login);
router.post('/logout', verifyCsrf, auth.logout);
router.get('/me', requireAuth, auth.me);
router.post('/change-password', requireAuth, verifyCsrf, validate({ body: changePasswordSchema }), auth.changePassword);

export default router;
