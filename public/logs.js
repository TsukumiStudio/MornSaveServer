const project = document.querySelector('#project');
const user = document.querySelector('#user');
const entries = document.querySelector('#entries');
const detail = document.querySelector('#detail');
const more = document.querySelector('#more');
const status = document.querySelector('#status');
let nextCursor = null;

async function api(path) {
  const response = await fetch(path);
  if (response.redirected || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Cloudflare Accessの認証を確認してください');
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function options(path, select) {
  select.replaceChildren();
  let cursor = null;
  do {
    const page = await api(path + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''));
    for (const value of page.items) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.append(option);
    }
    cursor = page.next_cursor;
  } while (cursor);
}

async function loadEntries(append = false) {
  if (!append) {
    entries.replaceChildren();
    detail.textContent = '';
    nextCursor = null;
  }
  if (!project.value || !user.value) return;
  const query = new URLSearchParams({ project_id: project.value, user_id: user.value });
  if (nextCursor) query.set('cursor', nextCursor);
  const page = await api(`/v1/admin/logs/entries?${query}`);
  for (const entry of page.items) {
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.title = entry.log_id;
    const name = document.createElement('span');
    name.className = 'log-id';
    name.textContent = entry.log_id;
    const time = document.createElement('small');
    time.textContent = new Date(entry.uploaded_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    button.append(name, time);
    button.addEventListener('click', () => showEntry(entry.log_id).catch(showError));
    row.append(button);
    entries.append(row);
  }
  nextCursor = page.next_cursor;
  more.hidden = !nextCursor;
  status.textContent = entries.children.length ? `${entries.children.length}件` : 'ログはありません';
  if (!append && page.items.length) await showEntry(page.items[0].log_id);
}

async function showEntry(logId) {
  const query = new URLSearchParams({ project_id: project.value, user_id: user.value, log_id: logId });
  const value = await api(`/v1/admin/logs/entry?${query}`);
  detail.textContent = JSON.stringify(value, null, 2);
}

function showError(error) { status.textContent = error.message; }

async function loadUsers() {
  entries.replaceChildren();
  detail.textContent = '';
  more.hidden = true;
  if (!project.value) return;
  await options(`/v1/admin/logs/users?project_id=${encodeURIComponent(project.value)}`, user);
  await loadEntries();
}

project.addEventListener('change', () => loadUsers().catch(showError));
user.addEventListener('change', () => loadEntries().catch(showError));
more.addEventListener('click', () => loadEntries(true).catch(showError));
options('/v1/admin/logs/projects?', project).then(loadUsers).catch(showError);
