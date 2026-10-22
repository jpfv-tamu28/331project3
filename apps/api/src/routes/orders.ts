import { Router, Request, Response } from 'express';
import { prisma } from '@boba/database';
import { OrderPayload } from '@boba/lib';

const router = Router();

router.post('/', async (req: Request<{}, {}, OrderPayload>, res: Response) => {
  try {
    const { items, discountCode } = req.body;
    
    // Mock price calculation for the backend
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * 5.50), 0);
    const finalAmount = discountCode === 'BOBA10' ? totalAmount * 0.9 : totalAmount;

    const order = await prisma.order.create({
      data: {
        totalAmount: finalAmount,
        status: 'PAID'
      }
    });

    res.status(201).json({ success: true, orderId: order.id });
  } catch (error) {
    console.error('Failed to process order:', error);
    res.status(500).json({ error: 'Failed to process checkout' });
  }
});

export default router;