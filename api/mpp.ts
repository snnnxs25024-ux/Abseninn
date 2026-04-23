import { google } from 'googleapis';

const COLUMN_MAP: Record<string, string> = {
  tanggal: 'A',
  totalRequest: 'G',
  schedule: 'H',
  position: 'I',
  request: 'BC',
  totalFulfillment: 'BD',
  gapNexus: 'BE',
  achievement: 'BF',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  let tokensCookie = req.cookies?.google_tokens;
  if (!tokensCookie && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)google_tokens=([^;]*)/);
    if (match) tokensCookie = match[1];
  }

  if (!tokensCookie) {
    return res.status(401).json({ error: 'Not authenticated. Please login again.' });
  }

  try {
    const decodedCookie = decodeURIComponent(tokensCookie);
    const tokens = JSON.parse(decodedCookie);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const spreadsheetId = '1203_SVnraS-2dzTcurZ9vah0kbliXfkQo2tPXmZT34g';

    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'MPP!A:BF', 
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) return res.json([]);

      const data = rows.slice(1).map((row: any[], index: number) => ({
        rowIndex: index + 2, // Headings on row 1, data starts at row 2
        tanggal: row[0] || '', // A = 0
        totalRequest: row[6] || '', // G = 6
        schedule: row[7] || '', // H = 7
        position: row[8] || '', // I = 8
        request: row[54] || '', // BC = 54 (A=0 ... Z=25, AA=26 ... AZ=51, BA=52, BB=53, BC=54)
        totalFulfillment: row[55] || '', // BD = 55
        gapNexus: row[56] || '', // BE = 56
        achievement: row[57] || '', // BF = 57
      }));

      return res.json(data);
    } 
    
    if (req.method === 'POST') {
      const { rowIndex, field, value } = req.body;
      if (!rowIndex || !field) {
        return res.status(400).json({ error: 'Missing rowIndex or field' });
      }

      const colLetter = COLUMN_MAP[field];
      if (!colLetter) {
        return res.status(400).json({ error: 'Unknown field mapping' });
      }

      const cellRange = `MPP!${colLetter}${rowIndex}`;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[value]]
        }
      });

      return res.json({ success: true, message: `Updated ${cellRange}` });
    }

  } catch (error: any) {
    console.error('Sheets API Error:', error.message || error);
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      res.setHeader('Set-Cookie', 'google_tokens=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      return res.status(401).json({ error: 'Session expired' });
    }
    res.status(500).json({ error: 'Failed to process request' });
  }
}
