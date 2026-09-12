 const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const dataPath = path.join(os.homedir(), '.chat2api', 'data.json');

  if (!fs.existsSync(dataPath)) {
    console.error('DATA_NOT_FOUND:', dataPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dataPath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('DATA_PARSE_ERROR:', err.message);
    process.exit(1);
  }

  const stepfunProvider = (data.providers || []).find(p => {
    const id = (p.id || '').toLowerCase();
    const api = (p.apiEndpoint || '').toLowerCase();
    return id.includes('stepfun') || api.includes('stepfun');
  });

  console.log('--- PROVIDER ---');
  console.log(JSON.stringify(stepfunProvider, null, 2));

  const stepfunAccounts = (data.accounts || []).filter(a => {
    const pid = String(a.providerId || '').toLowerCase();
    const name = String(a.name || '').toLowerCase();
    return pid.includes('stepfun') || name.includes('stepfun');
  });

  console.log('--- ACCOUNTS META ---');
  console.log(
    JSON.stringify(
      stepfunAccounts.map(a => ({
        id: a.id,
        name: a.name,
        providerId: a.providerId,
        status: a.status,
        credentialKeys: Object.keys((a.credentials || {})),
      })),
      null,
      2
    )
  );

  stepfunAccounts.forEach((a, idx) => {
    console.log(`--- ACCOUNT #${idx} credential key=value (encrypted) ---`);
    for (const [k, v] of Object.entries(a.credentials || {})) {
      console.log(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
  });