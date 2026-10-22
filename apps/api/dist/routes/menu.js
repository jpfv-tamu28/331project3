"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("@boba/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const drinks = await database_1.prisma.drink.findMany();
        // Group drinks by category for the frontend horizontal scroll
        const categories = [...new Set(drinks.map(d => d.category))];
        res.json({ categories, items: drinks });
    }
    catch (error) {
        console.error('Failed to fetch menu:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
