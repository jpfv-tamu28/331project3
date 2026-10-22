import app from './app';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';

dotenv.config();

app.use(express.static(path.join(__dirname, '../../web/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../web/dist/index.html'));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});