export default function handler(req: any, res: any) {
  // Clear the google_tokens cookie by setting its expiration to a date in the past
  res.setHeader('Set-Cookie', 'google_tokens=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
  res.json({ success: true, message: 'Logged out successfully' });
}
