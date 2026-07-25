const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const path = '/rest/v1/' + encodeURIComponent('院友主表') + '?select=' + encodeURIComponent('院友id,床號,station_id,bed_id') + '&limit=5';

const options = {
  hostname: 'mzeptzwuqvpjspxgnzkp.supabase.co',
  port: 443,
  path: path,
  method: 'GET',
  headers: {
    'apikey': token,
    'Authorization': 'Bearer ' + token,
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});

req.on('error', (e) => console.error('Error:', e));
req.end();
