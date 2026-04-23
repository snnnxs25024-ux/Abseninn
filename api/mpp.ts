import { google } from 'googleapis';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  let tokensCookie = req.cookies?.google_tokens;
  
  // Fallback manual cookie parsing for serverless environments if req.cookies is missing
  if (!tokensCookie && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)google_tokens=([^;]*)/);
    if (match) tokensCookie = match[1];
  }

  if (!tokensCookie) {
    return res.status(401).json({ error: 'Not authenticated. Please login again.' });
  }

  try {
    // Decode if encoded (fallback for older cookies or URL encoding)
    const decodedCookie = decodeURIComponent(tokensCookie);
    const tokens = JSON.parse(decodedCookie);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: '1203_SVnraS-2dzTcurZ9vah0kbliXfkQo2tPXmZT34g',
      range: 'MPP!A:H', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json([]);
    }

    const data = rows.slice(1).map((row: any[]) => ({
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
    console.error('Sheets API Error:', error.message || error);
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      res.setHeader('Set-Cookie', 'google_tokens=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      return res.status(401).json({ error: 'Session expired' });
    }
    res.status(500).json({ error: 'Failed to fetch data' });
  }
}
