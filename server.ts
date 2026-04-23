import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

// Import split Vercel API files
import authGoogle from './api/auth/google.js';
import authCallback from './api/auth/callback.js';
import authLogout from './api/auth/logout.js';
import mpp from './api/mpp.js';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Mount the serverless API routes here for local development simulation
  app.get('/api/auth/google', authGoogle);
  app.get('/api/auth/callback', authCallback);
  app.post('/api/auth/logout', authLogout);
  app.get('/api/mpp', mpp);
  app.post('/api/mpp', mpp);

  // Vite development middleware vs Static Production files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
