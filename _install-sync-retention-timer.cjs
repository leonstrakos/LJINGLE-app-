const fs = require('fs');
const cp = require('child_process');

const script =
  '/opt/ljingle/prune-sync-snapshots.cjs';

const timer =
  '/etc/systemd/system/ljingle-sync-prune.timer';

const service =
  '/etc/systemd/system/ljingle-sync-prune.service';

if (!fs.existsSync(script)) {
  throw new Error(
    'SAFE STOP - upload prune-sync-snapshots.cjs to /opt/ljingle first',
  );
}

fs.writeFileSync(
  service,
  `[Unit]
Description=LJingle cloud snapshot retention

[Service]
Type=oneshot
User=ljingle
Group=ljingle
ExecStart=/usr/bin/node /opt/ljingle/prune-sync-snapshots.cjs
`,
  'utf8',
);

fs.writeFileSync(
  timer,
  `[Unit]
Description=Daily LJingle cloud snapshot pruning

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
`,
  'utf8',
);

cp.execFileSync(
  'systemctl',
  ['daemon-reload'],
  { stdio: 'inherit' },
);

cp.execFileSync(
  'systemctl',
  [
    'enable',
    '--now',
    'ljingle-sync-prune.timer',
  ],
  { stdio: 'inherit' },
);

console.log('');
console.log('RETENTION TIMER INSTALLED ✓');
console.log('Runs daily as ljingle user.');
console.log('');

cp.execFileSync(
  'systemctl',
  [
    'start',
    'ljingle-sync-prune.service',
  ],
  { stdio: 'inherit' },
);

console.log('');
console.log('FIRST PRUNE COMPLETE ✓');
