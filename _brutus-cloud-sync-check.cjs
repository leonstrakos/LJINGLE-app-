const fs = require('fs');
const crypto = require('crypto');
const cp = require('child_process');
const path = require('path');

const envPath = path.join(
  process.cwd(),
  'mobile',
  '.env.local',
);

if (!fs.existsSync(envPath)) {
  console.error('MISSING mobile/.env.local');
  process.exit(1);
}

const env = fs.readFileSync(envPath, 'utf8');

function value(name) {
  const match = env.match(
    new RegExp('^' + name + '=(.+)$', 'm'),
  );
  return match?.[1]?.trim() || '';
}

const key = value('EXPO_PUBLIC_SYNC_KEY');
const url = value('EXPO_PUBLIC_SYNC_API_URL');

if (!key) {
  console.error('EXPO_PUBLIC_SYNC_KEY is missing.');
  process.exit(1);
}

const fp = crypto
  .createHash('sha256')
  .update(key)
  .digest('hex')
  .slice(0, 12);

console.log('SYNC URL:', url || '(default)');
console.log('LOCAL KEY LENGTH:', key.length);
console.log('LOCAL KEY SHA256/12:', fp);
console.log('');
console.log(
  'If Android still says Unauthorized, Metro/native bundle is using a different key or the VPS key differs.',
);
console.log(
  'Restart Expo/Metro with cache clear after changing .env.local.',
);
console.log('');
console.log('Expected restart:');
console.log('  cd mobile');
console.log('  npx expo start -c');
