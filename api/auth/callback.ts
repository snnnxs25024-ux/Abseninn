import { google } from 'googleapis';

export default async function handler(req: any, res: any) {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');

  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost:3000';
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    
    const { tokens } = await oauth2Client.getToken(code as string);
    
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    const cookieVal = encodeURIComponent(JSON.stringify(tokens));
    res.setHeader('Set-Cookie', `google_tokens=${cookieVal}; HttpOnly; Secure; Path=/; SameSite=Lax; Expires=${expires}`);
    
    res.redirect('/mpp');
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    res.status(500).send('Authentication failed');
  }
}
