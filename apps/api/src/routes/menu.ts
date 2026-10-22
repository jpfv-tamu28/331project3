import { Router, Request, Response } from 'express';
import { prisma } from '@boba/database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const drinks = await prisma.drink.findMany();
    
    // Group drinks by category for the frontend horizontal scroll
    const categories = [...new Set(drinks.map(d => d.category))];
    
    res.json({ categories, items: drinks });
  } catch (error) {
    console.error('Failed to fetch menu:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;