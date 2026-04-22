import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Use the exact redirect URI based on the request host dynamically
  const getRedirectUri = (req: express.Request) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    // We prioritize using the host that connects to avoid redirect_uri_mismatch
    return `${protocol}://${host}/api/auth/callback`;
  };

  // 1. Route to redirect to Google's consent screen
  app.get("/api/auth/google", (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Ensures we receive a refresh_token
      scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      prompt: 'consent' // Forces re-consent to guarantee a refresh_token
    });
    res.redirect(url);
  });

  // 2. Route to handle the callback from Google
  app.get("/api/auth/callback", async (req, res) => {
    const code = req.query.code as string;
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        getRedirectUri(req)
      );
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      
      // Store tokens tightly in secure, HttpOnly cookie so frontend can't read it directly
      res.cookie('google_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 Days
      });
      // Return user to the MPP page
      res.redirect('/mpp');
    } catch (error) {
      console.error('OAuth Callback Error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  // 3. Route to fetch MPP explicitly via Google Sheets API (Real-time!)
  // This takes the tokens from cookie, checks access, and grabs data
  app.get("/api/mpp", async (req, res) => {
    const tokensCookie = req.cookies.google_tokens;
    if (!tokensCookie) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const tokens = JSON.parse(tokensCookie);
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      
      // Load saved tokens
      oauth2Client.setCredentials(tokens);

      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      
      // Read MPP data from Google sheet securely!
      // This happens immediately vs Google's 15 min cache for CSV pub
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: '1203_SVnraS-2dzTcurZ9vah0kbliXfkQo2tPXmZT34g',
        range: 'MPP!A:H', 
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return res.json([]);
      }

      // Drop header and map data
      const data = rows.slice(1).map(row => ({
        tanggal: row[0] || '',
        totalRequest: row[1] || '',
        schedule: row[2] || '',
        position: row[3] || '',
        request: row[4] || '',
        totalFulfillment: row[5] || '',
        gapNexus: row[6] || '',
        achievement: row[7] || '',
      }));

      res.json(data);
    } catch (error: any) {
      console.error('Sheets API Error:', error);
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        res.clearCookie('google_tokens');
        return res.status(401).json({ error: 'Session expired' });
      }
      res.status(500).json({ error: 'Failed to fetch data' });
    }
  });

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
    // NOTE: For Express 5 (used here), standard wildcard behaves differently
    // However standard catch-all for SPA uses '*' fallback in most cases.
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
