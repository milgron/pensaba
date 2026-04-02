import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const root = document.getElementById('admin-root')!;

let supabase: SupabaseClient | null = null;

async function init(): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    root.innerHTML = '<h1>pensaba admin</h1><p>Supabase not configured</p>';
    return;
  }

  supabase = createClient(url, key);

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showThoughts();
  } else {
    showLogin();
  }
}

function showLogin(): void {
  root.innerHTML = `
    <h1>pensaba admin</h1>
    <div class="login-form">
      <input type="email" id="email" placeholder="email" />
      <input type="password" id="password" placeholder="password" />
      <button id="login-btn">login</button>
      <p id="login-error" style="color: #f55; margin-top: 8px;"></p>
    </div>
  `;

  document.getElementById('login-btn')!.addEventListener('click', async () => {
    const email = (document.getElementById('email') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const errorEl = document.getElementById('login-error')!;

    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = error.message;
    } else {
      showThoughts();
    }
  });
}

async function showThoughts(): Promise<void> {
  root.innerHTML = '<h1>pensaba admin</h1><p>cargando...</p>';

  const { data, error } = await supabase!
    .from('thoughts')
    .select('*')
    .is('deleted_at', null)
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    root.innerHTML = `<h1>pensaba admin</h1><p>Error: ${error.message}</p>`;
    return;
  }

  const rows = data || [];
  root.innerHTML = `
    <h1>pensaba admin (${rows.length} pensamientos hoy)</h1>
    <button id="refresh-btn" style="margin-bottom: 16px;">refrescar</button>
    <button id="logout-btn" style="margin-bottom: 16px; margin-left: 8px;">logout</button>
    <table>
      <thead>
        <tr>
          <th>hora</th>
          <th>apodo</th>
          <th>pensamiento</th>
          <th>pos</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r: any) => `
          <tr data-id="${r.id}">
            <td>${new Date(r.created_at).toLocaleTimeString()}</td>
            <td>${escapeHtml(r.nickname)}</td>
            <td>${escapeHtml(r.body)}</td>
            <td>t=${r.t.toFixed(2)}</td>
            <td><button class="delete-btn" data-id="${r.id}">borrar</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Bind delete buttons
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id;
      if (!id) return;
      const { error } = await supabase!
        .from('thoughts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        alert('Error: ' + error.message);
      } else {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        row?.remove();
      }
    });
  });

  document.getElementById('refresh-btn')!.addEventListener('click', () => showThoughts());
  document.getElementById('logout-btn')!.addEventListener('click', async () => {
    await supabase!.auth.signOut();
    showLogin();
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

init();
