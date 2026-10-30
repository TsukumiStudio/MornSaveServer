import test from 'node:test';
import assert from 'node:assert/strict';
import { logAdmin } from '../src/log_admin.js';
import worker from '../src/index.js';

const base = 'https://example.com';

function environment() {
  const calls = [];
  return {
    calls,
    LOGS: {
      async list(options) {
        calls.push(options);
        if (options.prefix === 'logs/') return { delimitedPrefixes: ['logs/game_a/'], truncated: false };
        if (options.prefix === 'logs/game_a/') return { delimitedPrefixes: ['logs/game_a/' + 'a'.repeat(32) + '/'], truncated: false };
        return { objects: [{ key: `logs/game_a/${'a'.repeat(32)}/session_1.json`, uploaded: new Date('2026-10-30T15:00:00Z') }], truncated: false };
      },
      async get(key) {
        calls.push(key);
        return { body: JSON.stringify({ project_id: 'game_a', data: { events: [] } }) };
      }
    }
  };
}

test('プロジェクト・ユーザー・ログを辿ってJSONを取得する', async () => {
  const env = environment();
  const user = 'a'.repeat(32);
  const get = path => logAdmin(new Request(base + path), env, new URL(base + path));
  assert.deepEqual((await (await get('/v1/admin/logs/projects')).json()).items, ['game_a']);
  assert.deepEqual((await (await get('/v1/admin/logs/users?project_id=game_a')).json()).items, [user]);
  const entries = await (await get(`/v1/admin/logs/entries?project_id=game_a&user_id=${user}`)).json();
  assert.deepEqual(entries.items, [{ log_id: 'session_1', uploaded_at: '2026-10-30T15:00:00.000Z' }]);
  const detail = await (await get(`/v1/admin/logs/entry?project_id=game_a&user_id=${user}&log_id=session_1`)).json();
  assert.equal(detail.project_id, 'game_a');
  assert.equal(env.calls.at(-1), `logs/game_a/${user}/session_1.json`);
});

test('閲覧APIと画面はAccess認証なしで読めない', async () => {
  const env = { ...environment(), DB: {}, ACCESS_AUD: 'test', ADMIN_LIMIT: { limit: async () => ({ success: true }) } };
  for (const path of ['/admin/logs/', '/admin/logs/app.js', '/v1/admin/logs/projects']) {
    assert.equal((await worker.fetch(new Request(base + path), env)).status, 403, path);
  }
});
