// Unit tests for the telemetry Lambda's request validation.
// Run with: node --test (Node 18+)

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRound, handler, MAX_BODY_BYTES, setDdbClient } from './index.mjs';

const clientRound = () => ({
  sessionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  schemaVersion: 1,
  timestamp: '2026-07-18T12:00:00.000Z',
  playerMove: 'Rock',
  aiMove: 'Paper',
  result: 'loss',
  strategy: 'learning',
  modelArch: 'dense',
  sequence: [
    { playerMove: 'Rock', aiMove: 'Scissors', result: 'win' },
    { playerMove: 'Rock', aiMove: 'Paper', result: 'loss' },
  ],
});

test('accepts the payload shape the web client sends', () => {
  assert.equal(validateRound(clientRound()), null);
});

test('accepts the fallback session id format', () => {
  const r = clientRound();
  r.sessionId = 's_abc123xyz';
  assert.equal(validateRound(r), null);
});

test('rejects sequence entries with unknown keys', () => {
  const r = clientRound();
  r.sequence[0].payload = 'x'.repeat(1000);
  assert.equal(validateRound(r), 'bad sequence entry');
});

test('rejects sequence entries with invalid enum values', () => {
  const r = clientRound();
  r.sequence[1].playerMove = 'x'.repeat(300000);
  assert.equal(validateRound(r), 'bad sequence entry');
});

test('rejects non-object sequence entries', () => {
  const r = clientRound();
  r.sequence = ['Rock', null, 42];
  assert.equal(validateRound(r), 'bad sequence entry');
});

test('rejects sessionId with invalid characters', () => {
  const r = clientRound();
  r.sessionId = '<script>alert(1)</script>';
  assert.equal(validateRound(r), 'bad sessionId');
});

test('still rejects missing top-level moves', () => {
  const r = clientRound();
  delete r.playerMove;
  assert.equal(validateRound(r), 'bad playerMove');
});

test('caches /stats responses so repeated GETs skip DynamoDB', async () => {
  let queries = 0;
  setDdbClient({
    send: async () => {
      queries += 1;
      return { Items: [] };
    },
  });
  const event = {
    requestContext: { http: { method: 'GET', path: '/stats' } },
    headers: {},
  };

  const first = await handler(event);
  assert.equal(first.statusCode, 200);
  const queriesAfterFirst = queries;
  assert.ok(queriesAfterFirst >= 1, 'first call must query DynamoDB');

  const second = await handler(event);
  assert.equal(second.statusCode, 200);
  assert.equal(queries, queriesAfterFirst, 'second call within the cache window must not query');
  assert.deepEqual(JSON.parse(second.body), JSON.parse(first.body));
});

test('handler rejects oversized bodies before parsing', async () => {
  const event = {
    requestContext: { http: { method: 'POST', path: '/round' } },
    headers: {},
    body: 'x'.repeat(MAX_BODY_BYTES + 1),
  };
  const res = await handler(event);
  assert.equal(res.statusCode, 413);
});
