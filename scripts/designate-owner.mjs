import {readFile} from 'node:fs/promises';

const [username] = process.argv.slice(2);
const port = Number(process.env.PORT ?? 4175);

if (!username || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: npm run admin:designate -- EXPLORER_USERNAME');
  process.exit(1);
}

try {
  const origin = 'http://127.0.0.1:' + port;
  const key = process.env.CQ_ADMIN_KEY || (await readFile('.local/maintenance-key', 'utf8')).trim();
  const response = await fetch(origin + '/api/admin', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: origin, 'x-cq-admin-key': key},
    body: JSON.stringify({action: 'designate-reading-admin', username}),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The local owner could not be designated.');
  console.log('Designated the existing local explorer as the Arcade owner.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
