"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});
// Mock Route for Menu (To be replaced with actual PostgreSQL queries)
app.get('/api/menu', (req, res) => {
    res.json({
        categories: ["Milk Teas", "Fruit Teas", "Smoothies", "Signature Mixes", "Seasonal Items"],
        items: [
            { id: 1, name: 'Classic Milk Tea', category: 'Milk Teas', price: 5.50 },
            { id: 2, name: 'Taro Slush', category: 'Smoothies', price: 6.00 }
        ]
    });
});
exports.default = app;
