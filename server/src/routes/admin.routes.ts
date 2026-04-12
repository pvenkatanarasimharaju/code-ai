import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { conversations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users });
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id as string;
    const { name, email, password } = req.body;

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (name?.trim()) data.name = name.trim();
    if (email?.trim()) {
      const dup = await prisma.user.findUnique({ where: { email: email.trim() } });
      if (dup && dup.id !== userId) {
        res.status(409).json({ error: 'Email already taken by another user' });
        return;
      }
      data.email = email.trim();
    }
    if (password?.trim()) {
      data.passwordHash = await bcrypt.hash(password.trim(), 12);
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
      data,
    });
    res.json({ user: updated });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id as string;
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (target.isAdmin) {
      res.status(403).json({ error: 'Cannot delete admin user' });
      return;
    }

    // Cascade deletes conversations + messages via schema relation
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'User and all associated data deleted' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as adminRoutes };
