import './env';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRoutes } from './routes/auth.routes';
import { chatRoutes } from './routes/chat.routes';
import { logAiEnvStatus } from './services/ai-provider';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:4200',
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist/client/browser');
  app.use(express.static(clientPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logAiEnvStatus();
});

export default app;
