import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const keyFileArg = process.argv[2] || 'PrivateKey/urbangaragesale-firebase-adminsdk-fbsvc-d4c97a0c2f.json';
const noDelete = process.argv.includes('--no-delete');

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

async function createNewKey(accessToken, serviceAccountEmail) {
  const url = `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}/keys`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE',
      keyAlgorithm: 'KEY_ALG_RSA_2048',
    }),
  });

  if (!resp.ok) {
    const details = await resp.text();
    throw new Error(`Create key failed (${resp.status}): ${details}`);
  }

  return resp.json();
}

async function deleteOldKey(accessToken, serviceAccountEmail, keyId) {
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
    throw new Error(`Delete old key failed (${resp.status}): ${details}`);
  }
}

async function main() {
  const keyPath = path.resolve(keyFileArg);
  const raw = await fs.readFile(keyPath, 'utf8');
  const currentKey = JSON.parse(raw);

  if (!currentKey.private_key || !currentKey.client_email || !currentKey.private_key_id) {
    throw new Error('Input key file is missing required service-account fields.');
  }

  console.log(`Rotating key for service account: ${currentKey.client_email}`);

  const accessToken = await getAccessToken(currentKey);
  const created = await createNewKey(accessToken, currentKey.client_email);

  if (!created.privateKeyData || !created.name) {
    throw new Error('IAM did not return expected key data.');
  }

  const newKeyJson = Buffer.from(created.privateKeyData, 'base64').toString('utf8');
  const newKey = JSON.parse(newKeyJson);

  const outDir = path.resolve('PrivateKey');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${newKey.project_id}-firebase-adminsdk-rotated-${newKey.private_key_id}.json`);
  await fs.writeFile(outPath, newKeyJson, { encoding: 'utf8', mode: 0o600 });

  console.log(`New key created: ${newKey.private_key_id}`);
  console.log(`Credential saved to: ${outPath}`);

  if (!noDelete) {
    await deleteOldKey(accessToken, currentKey.client_email, currentKey.private_key_id);
    console.log(`Old key revoked: ${currentKey.private_key_id}`);
  } else {
    console.log('Skipped old key revocation (--no-delete provided).');
  }
}

main().catch((err) => {
  console.error(`Rotation failed: ${err.message}`);
  process.exit(1);
});
