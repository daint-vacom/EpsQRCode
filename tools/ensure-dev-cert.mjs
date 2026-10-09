import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const certificatePath = fileURLToPath(new URL('../.cert/localhost.pfx', import.meta.url));

if (existsSync(certificatePath)) {
  process.exit(0);
}

if (process.platform !== 'win32') {
  console.error('Local HTTPS certificate is missing. Generate .cert/localhost.pfx with a localhost certificate before starting Vite.');
  process.exit(1);
}

const scriptPath = fileURLToPath(new URL('./generate-dev-cert.ps1', import.meta.url));
const powershell = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
  { stdio: 'inherit' },
);

if (powershell.error || powershell.status !== 0) {
  console.error('Could not create the local HTTPS certificate.');
  process.exit(powershell.status ?? 1);
}
