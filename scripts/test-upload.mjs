import fetch from 'node-fetch';

async function main() {
  const data = 'Test file from CI: ' + new Date().toISOString();
  const base64 = Buffer.from(data, 'utf8').toString('base64');
  const body = { filename: 'test-upload.txt', base64, contentType: 'text/plain' };

  console.log('Posting to http://localhost:8787/upload');
  const res = await fetch('http://localhost:8787/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log('Status:', res.status);
  try {
    console.log('Response:', JSON.parse(text));
  } catch (e) {
    console.log('Response text:', text);
  }
}

main().catch((e) => {
  console.error('Upload test failed:', e?.message || e);
  process.exit(1);
});
