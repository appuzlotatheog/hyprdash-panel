import { Router } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../../middleware/auth.js';
import { AuditService } from '../../services/audit.service.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

// GET /api/audit-logs
router.get('/', async (req: AuthRequest, res, next) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const userId = req.query.userId as string;

        const result = await AuditService.getLogs(page, limit, userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export { router as auditRouter };
