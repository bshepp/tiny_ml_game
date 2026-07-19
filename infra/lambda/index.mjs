// Lambda handler for the Roshambot telemetry API.
// Routes:
//   POST /round   -> append one anonymized round
//   GET  /stats   -> aggregate last 7 days

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

const TABLE = process.env.TABLE_NAME;
const TTL_DAYS = 90;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const VALID_MOVES = new Set(['Rock', 'Paper', 'Scissors']);
const VALID_RESULTS = new Set(['win', 'loss', 'tie']);
const VALID_STRATEGIES = new Set(['random', 'counter', 'pattern', 'learning']);
const VALID_ARCHS = new Set(['dense', 'gru', 'transformer']);

// Anything larger than this is not a legitimate round payload.
export const MAX_BODY_BYTES = 8 * 1024;
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const isValidSequenceEntry = (e) =>
  !!e && typeof e === 'object' && !Array.isArray(e) &&
  Object.keys(e).length <= 3 &&
  VALID_MOVES.has(e.playerMove) &&
  VALID_MOVES.has(e.aiMove) &&
  VALID_RESULTS.has(e.result);

const corsHeaders = (origin) => {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
};

const json = (statusCode, body, origin) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  body: JSON.stringify(body),
});

const dayKey = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `ROUND#${y}-${m}-${day}`;
};

export const validateRound = (r) => {
  if (!r || typeof r !== 'object') return 'invalid body';
  if (!VALID_MOVES.has(r.playerMove)) return 'bad playerMove';
  if (!VALID_MOVES.has(r.aiMove)) return 'bad aiMove';
  if (!VALID_RESULTS.has(r.result)) return 'bad result';
  if (r.strategy && !VALID_STRATEGIES.has(r.strategy)) return 'bad strategy';
  if (r.modelArch && !VALID_ARCHS.has(r.modelArch)) return 'bad modelArch';
  if (r.sessionId && (typeof r.sessionId !== 'string' || !SESSION_ID_RE.test(r.sessionId))) return 'bad sessionId';
  if (r.sequence && !Array.isArray(r.sequence)) return 'bad sequence';
  if (r.sequence && r.sequence.length > 10) return 'sequence too long';
  if (r.sequence && !r.sequence.every(isValidSequenceEntry)) return 'bad sequence entry';
  return null;
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.rawPath || '/';
  const origin = event.headers?.origin || event.headers?.Origin || '';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }

  try {
    if (method === 'POST' && path.endsWith('/round')) {
      if ((event.body || '').length > MAX_BODY_BYTES) {
        return json(413, { error: 'payload too large' }, origin);
      }
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return json(400, { error: 'invalid json' }, origin); }

      const err = validateRound(body);
      if (err) return json(400, { error: err }, origin);

      const now = new Date();
      const item = {
        pk: dayKey(now),
        sk: `${now.toISOString()}#${randomUUID()}`,
        playerMove: body.playerMove,
        aiMove: body.aiMove,
        result: body.result,
        strategy: body.strategy || 'random',
        modelArch: body.modelArch || 'dense',
        sessionId: body.sessionId || 'anon',
        sequence: body.sequence || [],
        ts: now.toISOString(),
        ttl: Math.floor(now.getTime() / 1000) + TTL_DAYS * 86400,
      };
      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      return json(204, {}, origin);
    }

    if (method === 'GET' && path.endsWith('/stats')) {
      const days = 7;
      const today = new Date();
      const items = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(today.getTime() - i * 86400000);
        const out = await ddb.send(new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': dayKey(d) },
          Limit: 5000,
        }));
        if (out.Items) items.push(...out.Items);
      }

      const byMove = {};
      const byResult = {};
      const byStrategy = {};
      const byArch = {};
      for (const it of items) {
        byMove[it.playerMove] = (byMove[it.playerMove] || 0) + 1;
        byResult[it.result] = (byResult[it.result] || 0) + 1;
        const sBucket = byStrategy[it.strategy] = byStrategy[it.strategy] || { n: 0, wins: 0 };
        sBucket.n++;
        if (it.result === 'win') sBucket.wins++;
        const aBucket = byArch[it.modelArch] = byArch[it.modelArch] || { n: 0, wins: 0 };
        aBucket.n++;
        if (it.result === 'win') aBucket.wins++;
      }
      for (const k of Object.keys(byStrategy)) byStrategy[k].winRate = byStrategy[k].wins / byStrategy[k].n;
      for (const k of Object.keys(byArch)) byArch[k].winRate = byArch[k].wins / byArch[k].n;

      return json(200, {
        totalRounds: items.length,
        byMove,
        byResult,
        byStrategy,
        byArch,
        windowDays: days,
        generatedAt: new Date().toISOString(),
      }, origin);
    }

    return json(404, { error: 'not found' }, origin);
  } catch (e) {
    console.error('handler error', e);
    return json(500, { error: 'internal' }, origin);
  }
};
