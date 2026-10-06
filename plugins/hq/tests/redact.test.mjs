import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeTool } from '../runtime/lib/transcripts.mjs';
import { redact, safeLine } from '../runtime/lib/util.mjs';

const SECRETS = [
  ['export OPENAI_KEY=sk-proj-abcdefghij1234567890', 'sk-proj-abcdefghij1234567890'],
  ['token ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
  ['github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuv', 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuv'],
  ['slack xoxb-1234567890-abcdefghij', 'xoxb-1234567890-abcdefghij'],
  ['aws AKIAABCDEFGHIJKLMNOP', 'AKIAABCDEFGHIJKLMNOP'],
  ['curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig"', 'eyJhbGciOiJIUzI1NiJ9.payload.sig'],
  ['mysql --password=hunter2hunter2', 'hunter2hunter2'],
  ['api_key: "abc123def456"', 'abc123def456'],
  ['postgres://admin:s3cretpw@db.example.com/app', 's3cretpw'],
  ['mail me at someone@example.com', 'someone@example.com'],
];

test('redacts every common credential shape', () => {
  for (const [input, secret] of SECRETS) {
    const out = redact(input);
    assert.ok(!out.includes(secret), `leaked in: ${out}`);
  }
});

test('keeps ordinary text readable', () => {
  assert.equal(redact('Run cart tests'), 'Run cart tests');
  assert.equal(safeLine('## Heading\n\nbody', 50), 'Heading');
});

test('tool descriptions never carry secrets from commands', () => {
  const [text] = describeTool('Bash', { command: 'curl -H "Authorization: Bearer abcdefghijklmnop" https://api.example.com' });
  assert.ok(!text.includes('abcdefghijklmnop'), text);
  const [w, p] = describeTool('Write', { file_path: '/repo/app/.env', content: 'SECRET=1' }, '/repo');
  assert.equal(w, 'Writing app/.env');
  assert.equal(p, 'app/.env');
});
