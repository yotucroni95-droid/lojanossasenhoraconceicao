// Função "equipe" do banco Órbita Sites (Supabase Edge Function).
// Cria logins, libera e tira acesso e troca senha da equipe de um site.
// Roda no servidor do Supabase: a chave secreta fica lá e nunca vai para o site.
// Instalação: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "equipe" → cole este arquivo → Deploy.
import {createClient} from 'npm:@supabase/supabase-js@2.45.4';

const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {status, headers: {...cors, 'Content-Type': 'application/json'}});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (req.method !== 'POST') return resp({erro: 'Pedido inválido.'}, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth: {persistSession: false, autoRefreshToken: false}});

  // Quem está pedindo (pelo login do painel).
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const {data: quem} = await admin.auth.getUser(token);
  const eu = quem?.user?.email?.toLowerCase();
  if (!eu) return resp({erro: 'Sua sessão expirou. Saia e entre de novo no painel.'}, 401);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return resp({erro: 'Pedido inválido.'}, 400); }
  const site = String(b.site || ''), acao = String(b.acao || '');
  if (!/^[a-z0-9-]{2,40}$/.test(site)) return resp({erro: 'Site inválido.'}, 400);

  const {data: minhas} = await admin.from('equipe').select('site,papel').eq('email', eu);
  const orbita = (minhas || []).some(r => r.site === '*');
  const dono = orbita || (minhas || []).some(r => r.site === site && r.papel === 'dono');
  if (!dono) return resp({erro: 'Só o dono da loja ou a Órbita podem mexer na equipe.'}, 403);

  if (acao === 'listar') {
    const {data, error} = await admin.from('equipe').select('email,papel').eq('site', site).order('email');
    return error ? resp({erro: error.message}, 500) : resp({equipe: data});
  }

  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resp({erro: 'E-mail inválido.'}, 400);
  if (email === eu) return resp({erro: 'Para a sua própria conta, use a aba "Minha senha".'}, 400);

  // O dono só mexe em quem é apenas deste site (não pode mexer na Órbita nem em pessoas de outras lojas).
  const {data: dele} = await admin.from('equipe').select('site,papel').eq('email', email);
  const soDeste = (dele || []).every(r => r.site === site);
  const ehDonoAlvo = (dele || []).some(r => r.site === site && r.papel === 'dono');
  if (!orbita && (acao === 'senha' || acao === 'remover') && (!soDeste || ehDonoAlvo)) return resp({erro: 'Só a Órbita pode mexer no acesso desta pessoa.'}, 403);

  if (acao === 'adicionar') {
    const papel = orbita && b.papel === 'dono' ? 'dono' : 'funcionario';
    const senha = String(b.senha || '');
    if (senha.length < 8) return resp({erro: 'A senha precisa ter pelo menos 8 caracteres.'}, 400);
    const {error: e1} = await admin.auth.admin.createUser({email, password: senha, email_confirm: true});
    const jaTinhaLogin = !!e1 && /already|registered|exists/i.test(e1.message);
    if (e1 && !jaTinhaLogin) return resp({erro: 'Não foi possível criar o login: ' + e1.message}, 400);
    const {error: e2} = await admin.from('equipe').upsert({email, site, papel});
    return e2 ? resp({erro: e2.message}, 500) : resp({ok: true, jaTinhaLogin});
  }

  if (acao === 'remover') {
    const {error} = await admin.from('equipe').delete().eq('site', site).eq('email', email);
    return error ? resp({erro: error.message}, 500) : resp({ok: true});
  }

  if (acao === 'senha') {
    if (!(dele || []).some(r => r.site === site)) return resp({erro: 'Essa pessoa não é da equipe deste site.'}, 404);
    const senha = String(b.senha || '');
    if (senha.length < 8) return resp({erro: 'A senha precisa ter pelo menos 8 caracteres.'}, 400);
    for (let page = 1; page < 50; page++) {
      const {data, error} = await admin.auth.admin.listUsers({page, perPage: 1000});
      if (error) return resp({erro: error.message}, 500);
      const u = data.users.find(x => x.email?.toLowerCase() === email);
      if (u) {
        const {error: e} = await admin.auth.admin.updateUserById(u.id, {password: senha});
        return e ? resp({erro: e.message}, 500) : resp({ok: true});
      }
      if (data.users.length < 1000) break;
    }
    return resp({erro: 'Login não encontrado.'}, 404);
  }

  return resp({erro: 'Ação desconhecida.'}, 400);
});
