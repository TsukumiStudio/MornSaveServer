const PROJECT = /^[A-Za-z0-9_-]{1,64}$/;
const USER = /^[0-9a-f]{32}$/;
const LOG = /^[A-Za-z0-9_-]{1,64}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export async function logAdmin(request, env, url) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  if (!env.LOGS) return json({ error: 'service_unavailable' }, 503);
  const cursor = url.searchParams.get('cursor');
  if (cursor && cursor.length > 2048) return json({ error: 'invalid_cursor' }, 400);
  if (url.pathname === '/v1/admin/logs/projects') {
    const page = await env.LOGS.list({ prefix: 'logs/', delimiter: '/', limit: 100, ...(cursor ? { cursor } : {}) });
    return json({ items: page.delimitedPrefixes.map(prefix => prefix.slice(5, -1)), next_cursor: page.truncated ? page.cursor : null });
  }
  const projectId = url.searchParams.get('project_id');
  if (!projectId || !PROJECT.test(projectId)) return json({ error: 'invalid_project_id' }, 400);
  if (url.pathname === '/v1/admin/logs/users') {
    const prefix = `logs/${projectId}/`;
    const page = await env.LOGS.list({ prefix, delimiter: '/', limit: 100, ...(cursor ? { cursor } : {}) });
    return json({ items: page.delimitedPrefixes.map(value => value.slice(prefix.length, -1)), next_cursor: page.truncated ? page.cursor : null });
  }
  const userId = url.searchParams.get('user_id');
  if (!userId || !USER.test(userId)) return json({ error: 'invalid_user_id' }, 400);
  if (url.pathname === '/v1/admin/logs/entries') {
    const prefix = `logs/${projectId}/${userId}/`;
    const page = await env.LOGS.list({ prefix, limit: 50, ...(cursor ? { cursor } : {}) });
    return json({
      items: page.objects.map(object => ({ log_id: object.key.slice(prefix.length, -5), uploaded_at: object.uploaded.toISOString() })),
      next_cursor: page.truncated ? page.cursor : null
    });
  }
  if (url.pathname === '/v1/admin/logs/entry') {
    const logId = url.searchParams.get('log_id');
    if (!logId || !LOG.test(logId)) return json({ error: 'invalid_log_id' }, 400);
    const object = await env.LOGS.get(`logs/${projectId}/${userId}/${logId}.json`);
    if (!object) return json({ error: 'not_found' }, 404);
    return new Response(object.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return json({ error: 'not_found' }, 404);
}
