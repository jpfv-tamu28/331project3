"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("@boba/database");
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const { items, discountCode } = req.body;
        // Mock price calculation for the backend
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * 5.50), 0);
        const finalAmount = discountCode === 'BOBA10' ? totalAmount * 0.9 : totalAmount;
        const order = await database_1.prisma.order.create({
            data: {
                totalAmount: finalAmount,
                status: 'PAID'
            }
        });
        res.status(201).json({ success: true, orderId: order.id });
    }
    catch (error) {
        console.error('Failed to process order:', error);
        res.status(500).json({ error: 'Failed to process checkout' });
    }
});
exports.default = router;
