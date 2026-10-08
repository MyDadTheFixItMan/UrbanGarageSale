import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const keyFileArg = process.argv[2] || 'PrivateKey/urbangaragesale-firebase-adminsdk-fbsvc-d4c97a0c2f.json';
const keyIdArg = process.argv[3];

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const assertion = `${unsigned}.${signature}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenResp.ok) {
    const details = await tokenResp.text();
    throw new Error(`Token exchange failed (${tokenResp.status}): ${details}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

async function revokeKey(accessToken, serviceAccountEmail, keyId) {
  const keyResource = `projects/-/serviceAccounts/${serviceAccountEmail}/keys/${keyId}`;
  const url = `https://iam.googleapis.com/v1/${encodeURIComponent(keyResource).replace(/%2F/g, '/')}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!resp.ok) {
    const details = await resp.text();
    throw new Error(`Delete key failed (${resp.status}): ${details}`);
  }
}

async function main() {
  const keyPath = path.resolve(keyFileArg);
  const raw = await fs.readFile(keyPath, 'utf8');
  const keyData = JSON.parse(raw);
  const keyId = keyIdArg || keyData.private_key_id;

  if (!keyData.client_email || !keyData.private_key || !keyId) {
    throw new Error('Missing required key fields.');
  }

  const token = await getAccessToken(keyData);
  await revokeKey(token, keyData.client_email, keyId);
  console.log(`Revoked key: ${keyId}`);
}

main().catch((err) => {
  console.error(`Revoke failed: ${err.message}`);
  process.exit(1);
});
