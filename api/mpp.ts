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
    const spreadsheetId = '1hjs0cXmEhT7iQ05jm5RkjdWGLrht3aGNwXFCkz5rt-o';

    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: ["'DW Oncall'!A:A", "'DW Oncall'!G:I", "'DW Oncall'!BC:BF"], 
      });

      const valueRanges = response.data.valueRanges;
      if (!valueRanges || valueRanges.length < 3) return res.json([]);

      const colA = valueRanges[0].values || [];
      const colG_I = valueRanges[1].values || [];
      const colBC_BF = valueRanges[2].values || [];

      // Determine max rows based on Column A
      const maxRows = colA.length;
      if (maxRows <= 2) return res.json([]); // Assuming row 1 & 2 are headers based on Sheet image

      const data = [];
      // Row 1 & 2 are titles. Row 3 is often headings (e.g. "Tanggal"). Row 4 onwards is data.
      for (let i = 2; i < maxRows; i++) {
        const row_A = colA[i] || [];
        const row_G_I = colG_I[i] || [];
        const row_BC_BF = colBC_BF[i] || [];

        // Skip the header row if it leaked into the data
        if (row_A[0]?.toString().toLowerCase() === 'tanggal') {
          continue;
        }

        data.push({
          rowIndex: i + 1, // Sheets are 1-indexed
          tanggal: row_A[0] || '', // A
          totalRequest: row_G_I[0] || '', // G
          schedule: row_G_I[1] || '', // H
          position: row_G_I[2] || '', // I
          request: row_BC_BF[0] || '', // BC
          totalFulfillment: row_BC_BF[1] || '', // BD
          gapNexus: row_BC_BF[2] || '', // BE
          achievement: row_BC_BF[3] || '', // BF
        });
      }

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

      const cellRange = `'DW Oncall'!${colLetter}${rowIndex}`;
      
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
