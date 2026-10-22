import express, { Application, Request, Response } from 'express';
import cors from 'cors';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Mock Route for Menu (To be replaced with actual PostgreSQL queries)
app.get('/api/menu', (req: Request, res: Response) => {
  res.json({
    categories: ["Milk Teas", "Fruit Teas", "Smoothies", "Signature Mixes", "Seasonal Items"],
    items: [
      { id: 1, name: 'Classic Milk Tea', category: 'Milk Teas', price: 5.50 },
      { id: 2, name: 'Taro Slush', category: 'Smoothies', price: 6.00 }
    ]
  });
});

export default app;