const COOKIE = 'smam2_session';
const SESSION_SECONDS = 60 * 60 * 12;
const EURO4 = 10000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

function html(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

function redirect(url, headers = {}) {
  return new Response(null, { status: 303, headers: { location: url, ...headers } });
}

function parseCookies(req) {
  const raw = req.headers.get('cookie') || '';
  const out = {};
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function hex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

async function sha256(s) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let v = 0;
  for (let i = 0; i < ha.length; i++) v |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return v === 0;
}

async function makeSession(secret) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${exp}.${await hmac(secret, String(exp))}`;
}

async function validSession(req, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const token = parseCookies(req)[COOKIE];
  if (!token) return false;
  const [expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!exp || exp < Math.floor(Date.now() / 1000) || !sig) return false;
  return safeEqual(sig, await hmac(env.ADMIN_PASSWORD, String(exp)));
}

function loginPage(error = '') {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SMAM2 · Accesso</title><style>
  *{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#eef2f6;color:#17212b;min-height:100vh;display:grid;place-items:center}.card{width:min(430px,calc(100vw - 32px));background:white;border-radius:24px;padding:34px;box-shadow:0 18px 60px #24354a1c;border:1px solid #dfe6ee}.brand{font-size:13px;font-weight:800;letter-spacing:.12em;color:#607080}.title{font-size:30px;font-weight:850;margin:8px 0 6px}.sub{color:#687583;margin:0 0 24px}.err{padding:10px 12px;background:#fff0f0;color:#a32323;border-radius:10px;margin-bottom:14px}.field{display:grid;gap:7px;font-weight:700;font-size:14px}.field input{font:inherit;padding:13px 14px;border:1px solid #ccd6e0;border-radius:12px;outline:none}.field input:focus{border-color:#263746;box-shadow:0 0 0 3px #26374612}button{width:100%;margin-top:16px;border:0;border-radius:12px;padding:13px;background:#17212b;color:#fff;font-weight:800;font-size:15px;cursor:pointer}.foot{font-size:12px;color:#8b96a2;margin-top:18px;text-align:center}</style></head><body><form class="card" method="post" action="/login"><div class="brand">MW SRL · SERVIZIO SARTORIA</div><div class="title">SMAM2</div><p class="sub">Gestionale amministrativo e rendicontazione</p>${error ? `<div class="err">${error}</div>` : ''}<label class="field">Password<input name="password" type="password" autocomplete="current-password" autofocus required></label><button type="submit">Accedi</button><div class="foot">Accesso protetto da secret Cloudflare</div></form></body></html>`;
}

function clean(v) { return String(v ?? '').trim(); }
function upper(v) { return clean(v).toLocaleUpperCase('it-IT'); }
function int(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function moneyCents(v) { return Math.max(0, Math.round(num(v) * 100)); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function range(url) { return { from: url.searchParams.get('from') || '0000-01-01', to: url.searchParams.get('to') || '9999-12-31' }; }

async function setting(env, key, fallback = '') {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key=?').bind(key).first();
  return row ? row.value : fallback;
}

async function globalDiscount(env) {
  return Math.max(0, Math.min(100, num(await setting(env, 'global_discount_percent', '0'), 0)));
}

// Il ribasso contrattuale si applica esclusivamente al 10% del prezzo unitario.
// Precisione unitario: 4 decimali di euro; arrotondamento economico sul totale riga ai centesimi.
function calcLine(unitCents, qty, discountPercent, vatPercent = 22) {
  qty = Math.max(0, int(qty));
  unitCents = Math.max(0, int(unitCents));
  const unitGross4 = unitCents * 100;                 // 1 euro = 10.000 unità
  const unitDiscount4 = Math.round(unitGross4 * num(discountPercent) / 1000); // 10% × ribasso%
  const unitNet4 = unitGross4 - unitDiscount4;
  const grossCents = unitCents * qty;
  const netCents = Math.round((unitNet4 * qty) / 100);
  const discountCents = grossCents - netCents;
  const vatCents = Math.round(netCents * num(vatPercent, 22) / 100);
  return { unitGross4, unitDiscount4, unitNet4, grossCents, discountCents, netCents, vatCents, totalCents: netCents + vatCents };
}

async function workRows(env, filters = {}) {
  const { from = '0000-01-01', to = '9999-12-31', course = '', student = '', repair = '', studentId = 0 } = filters;
  const ps = `%${student}%`, pr = `%${repair}%`;
  const q = `SELECT wi.id,wi.work_date,wi.quantity,wi.notes,wi.student_id,wi.tariff_id,
      s.first_name,s.last_name,s.course,
      t.garment_type,t.repair_code,t.repair_description,t.taxable_amount_cents,t.vat_percent
    FROM student_work_items wi
    JOIN students s ON s.id=wi.student_id
    JOIN repair_tariffs t ON t.id=wi.tariff_id
    WHERE wi.work_date BETWEEN ? AND ?
      AND (?='' OR s.course=?)
      AND (?='' OR s.first_name LIKE ? OR s.last_name LIKE ? OR (s.last_name||' '||s.first_name) LIKE ?)
      AND (?='' OR t.repair_description LIKE ? OR t.garment_type LIKE ?)
      AND (?=0 OR s.id=?)
    ORDER BY wi.work_date DESC,s.last_name,s.first_name,t.garment_type,t.repair_code,wi.id DESC`;
  return (await env.DB.prepare(q).bind(from,to,course,course,student,ps,ps,ps,repair,pr,pr,studentId,studentId).all()).results;
}

async function economics(env, filters = {}) {
  const gd = await globalDiscount(env);
  const rows = await workRows(env, filters);
  const revenue = { gross:0, discount:0, net:0, vat:0, total:0 };
  for (const r of rows) {
    const c = calcLine(r.taxable_amount_cents, r.quantity, gd, r.vat_percent);
    Object.assign(r, {
      discount_percent: gd,
      unit_net_4: c.unitNet4,
      gross_cents: c.grossCents,
      discount_cents: c.discountCents,
      net_cents: c.netCents,
      vat_cents: c.vatCents,
      total_cents: c.totalCents
    });
    revenue.gross += c.grossCents; revenue.discount += c.discountCents; revenue.net += c.netCents; revenue.vat += c.vatCents; revenue.total += c.totalCents;
  }
  const from = filters.from || '0000-01-01', to = filters.to || '9999-12-31';
  const manual = await env.DB.prepare(`SELECT COALESCE(SUM(taxable_amount_cents),0) net,
      COALESCE(SUM(ROUND(taxable_amount_cents*vat_percent/100.0)),0) vat
      FROM expenses WHERE expense_date BETWEEN ? AND ?`).bind(from,to).first();
  const labor = await env.DB.prepare(`SELECT COALESCE(SUM(h.minutes*e.hourly_rate_cents/60),0) net
      FROM employee_hours h JOIN employees e ON e.id=h.employee_id WHERE h.work_date BETWEEN ? AND ?`).bind(from,to).first();
  const manualNet = int(manual?.net), manualVat = int(manual?.vat), laborNet = int(labor?.net);
  const costs = { manual_net:manualNet, manual_vat:manualVat, manual_total:manualNet+manualVat, labor_net:laborNet, net:manualNet+laborNet, vat:manualVat, total:manualNet+manualVat+laborNet };
  return { globalDiscountPercent:gd, rows, revenue, costs, margin_cents: revenue.net - costs.net };
}

function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function euro(cents) { return (Number(cents || 0) / 100).toFixed(2).replace('.', ','); }
function euro4(v4) { return (Number(v4 || 0) / 10000).toFixed(4).replace('.', ','); }

async function handleApi(req, env, url) {
  const path = url.pathname;

  if (req.method === 'GET' && path === '/api/me') return json({ ok:true });

  // DASHBOARD
  if (req.method === 'GET' && path === '/api/dashboard') {
    const {from,to} = range(url);
    const e = await economics(env,{from,to});
    const [students,workCount,employees,payments] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) n FROM students WHERE active=1').first(),
      env.DB.prepare('SELECT COALESCE(SUM(quantity),0) n FROM student_work_items WHERE work_date BETWEEN ? AND ?').bind(from,to).first(),
      env.DB.prepare('SELECT COUNT(*) n FROM employees WHERE active=1').first(),
      env.DB.prepare(`SELECT COALESCE(SUM(p.amount_cents),0) paid FROM employee_payments p WHERE p.payment_date BETWEEN ? AND ?`).bind(from,to).first()
    ]);
    return json({...e, kpi:{students:int(students?.n),works:int(workCount?.n),employees:int(employees?.n),payments_cents:int(payments?.paid)}});
  }

  // SETTINGS / TARIFFS
  if (req.method === 'GET' && path === '/api/tariffs') {
    return json({ tariffs:(await env.DB.prepare('SELECT * FROM repair_tariffs ORDER BY garment_type,repair_code').all()).results, globalDiscountPercent:await globalDiscount(env) });
  }
  if (req.method === 'PUT' && path === '/api/settings/discount') {
    const b = await req.json(); const d = Math.max(0,Math.min(100,num(b.percent)));
    await env.DB.prepare(`INSERT INTO app_settings(key,value) VALUES('global_discount_percent',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(d.toFixed(4)).run();
    return json({ok:true,percent:d});
  }
  if (req.method === 'POST' && path === '/api/tariffs') {
    const b = await req.json();
    const garment = upper(b.garmentType), desc = clean(b.description), code = int(b.repairCode);
    if (!garment || !desc || code <= 0) return json({error:'Dati tariffa incompleti'},400);
    await env.DB.prepare(`INSERT INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent,active)
      VALUES(?,?,?,?,22,1) ON CONFLICT(garment_type,repair_code) DO UPDATE SET repair_description=excluded.repair_description,taxable_amount_cents=excluded.taxable_amount_cents,active=1,updated_at=CURRENT_TIMESTAMP`)
      .bind(garment,code,desc,moneyCents(b.taxableAmount)).run();
    return json({ok:true});
  }
  let m = path.match(/^\/api\/tariffs\/(\d+)$/);
  if (m && req.method === 'PUT') {
    const b = await req.json();
    await env.DB.prepare(`UPDATE repair_tariffs SET garment_type=?,repair_code=?,repair_description=?,taxable_amount_cents=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(upper(b.garmentType),int(b.repairCode),clean(b.description),moneyCents(b.taxableAmount),b.active===false?0:1,int(m[1])).run();
    return json({ok:true});
  }

  // STUDENTS
  if (req.method === 'GET' && path === '/api/students') {
    const search = clean(url.searchParams.get('search')), course = clean(url.searchParams.get('course')), p=`%${search}%`;
    const rows = (await env.DB.prepare(`SELECT s.*,
      COALESCE((SELECT SUM(w.quantity) FROM student_work_items w WHERE w.student_id=s.id),0) total_work_qty,
      COALESCE((SELECT COUNT(*) FROM student_work_items w WHERE w.student_id=s.id),0) work_rows
      FROM students s WHERE (?='' OR s.first_name LIKE ? OR s.last_name LIKE ? OR (s.last_name||' '||s.first_name) LIKE ?)
      AND (?='' OR s.course=?) ORDER BY s.last_name,s.first_name`).bind(search,p,p,p,course,course).all()).results;
    const courses=(await env.DB.prepare(`SELECT DISTINCT course FROM students WHERE course<>'' ORDER BY course`).all()).results.map(x=>x.course);
    return json({students:rows,courses});
  }
  if (req.method === 'POST' && path === '/api/students') {
    const b=await req.json(), first=upper(b.firstName), last=upper(b.lastName), course=upper(b.course);
    if(!first||!last)return json({error:'Nome e cognome obbligatori'},400);
    try {
      const r=await env.DB.prepare(`INSERT INTO students(first_name,last_name,course,notes) VALUES(?,?,?,?)`).bind(first,last,course,clean(b.notes)).run();
      return json({ok:true,id:r.meta.last_row_id});
    } catch(e) { return json({error:'Allievo già presente con lo stesso corso'},409); }
  }
  if (req.method === 'POST' && path === '/api/students/import') {
    const b=await req.json(), rows=Array.isArray(b.rows)?b.rows:[]; let inserted=0, skipped=0;
    for (const x of rows.slice(0,2000)) {
      const first=upper(x.firstName), last=upper(x.lastName), course=upper(x.course);
      if(!first||!last){skipped++;continue;}
      const r=await env.DB.prepare(`INSERT OR IGNORE INTO students(first_name,last_name,course,notes) VALUES(?,?,?,?)`).bind(first,last,course,clean(x.notes)).run();
      if(r.meta.changes)inserted++;else skipped++;
    }
    return json({ok:true,inserted,skipped});
  }
  m = path.match(/^\/api\/students\/(\d+)$/);
  if (m && req.method === 'GET') {
    const s=await env.DB.prepare('SELECT * FROM students WHERE id=?').bind(int(m[1])).first();
    if(!s)return json({error:'Allievo non trovato'},404);
    return json({student:s});
  }
  if (m && req.method === 'PUT') {
    const b=await req.json();
    await env.DB.prepare(`UPDATE students SET first_name=?,last_name=?,course=?,notes=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(upper(b.firstName),upper(b.lastName),upper(b.course),clean(b.notes),b.active===false?0:1,int(m[1])).run();
    return json({ok:true});
  }

  // STUDENT SHEET / WORK
  m = path.match(/^\/api\/students\/(\d+)\/work$/);
  if (m && req.method === 'GET') {
    const id=int(m[1]); const s=await env.DB.prepare('SELECT * FROM students WHERE id=?').bind(id).first();
    if(!s)return json({error:'Allievo non trovato'},404);
    const gd=await globalDiscount(env), rows=await workRows(env,{studentId:id});
    const totals={gross:0,discount:0,net:0,vat:0,total:0,qty:0};
    for(const r of rows){const c=calcLine(r.taxable_amount_cents,r.quantity,gd,r.vat_percent);Object.assign(r,{unit_net_4:c.unitNet4,gross_cents:c.grossCents,discount_cents:c.discountCents,net_cents:c.netCents,vat_cents:c.vatCents,total_cents:c.totalCents});totals.gross+=c.grossCents;totals.discount+=c.discountCents;totals.net+=c.netCents;totals.vat+=c.vatCents;totals.total+=c.totalCents;totals.qty+=int(r.quantity)}
    const tariffs=(await env.DB.prepare('SELECT * FROM repair_tariffs WHERE active=1 ORDER BY garment_type,repair_code').all()).results;
    const qtyByTariff={};
    for(const r of rows) qtyByTariff[r.tariff_id]=(qtyByTariff[r.tariff_id]||0)+int(r.quantity);
    return json({student:s,work:rows,tariffs,qtyByTariff,totals,globalDiscountPercent:gd});
  }
  if (m && req.method === 'POST') {
    const studentId=int(m[1]), b=await req.json(), tariffId=int(b.tariffId), q=Math.max(0,int(b.quantity));
    if(!tariffId||q<=0)return json({error:'Lavorazione e quantità obbligatorie'},400);
    const r=await env.DB.prepare(`INSERT INTO student_work_items(student_id,tariff_id,work_date,quantity,notes) VALUES(?,?,?,?,?)`).bind(studentId,tariffId,clean(b.workDate)||todayISO(),q,clean(b.notes)).run();
    return json({ok:true,id:r.meta.last_row_id});
  }
  m = path.match(/^\/api\/students\/(\d+)\/work-bulk$/);
  if (m && req.method === 'PUT') {
    const studentId=int(m[1]), b=await req.json(), items=Array.isArray(b.items)?b.items:[];
    const student=await env.DB.prepare('SELECT id FROM students WHERE id=?').bind(studentId).first();
    if(!student)return json({error:'Allievo non trovato'},404);
    const desired=new Map();
    for(const x of items){const tariffId=int(x.tariffId),quantity=Math.max(0,int(x.quantity));if(tariffId)desired.set(tariffId,quantity)}
    const existing=(await env.DB.prepare(`SELECT id,tariff_id,quantity FROM student_work_items WHERE student_id=? ORDER BY work_date DESC,id DESC`).bind(studentId).all()).results;
    const byTariff=new Map();
    for(const r of existing){if(!byTariff.has(r.tariff_id))byTariff.set(r.tariff_id,[]);byTariff.get(r.tariff_id).push(r)}
    const tariffIds=new Set([...desired.keys()]);
    const statements=[];
    for(const tariffId of tariffIds){
      const rows=byTariff.get(tariffId)||[];
      const current=rows.reduce((a,r)=>a+int(r.quantity),0), target=desired.get(tariffId)||0;
      if(target>current){
        statements.push(env.DB.prepare(`INSERT INTO student_work_items(student_id,tariff_id,work_date,quantity,notes) VALUES(?,?,?,?,?)`).bind(studentId,tariffId,clean(b.workDate)||todayISO(),target-current,''));
      } else if(target<current){
        let remove=current-target;
        for(const r of rows){
          if(remove<=0)break;
          const q=int(r.quantity);
          if(q<=remove){statements.push(env.DB.prepare('DELETE FROM student_work_items WHERE id=?').bind(r.id));remove-=q}
          else {statements.push(env.DB.prepare('UPDATE student_work_items SET quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(q-remove,r.id));remove=0}
        }
      }
    }
    if(statements.length)await env.DB.batch(statements);
    return json({ok:true,changes:statements.length});
  }

  m = path.match(/^\/api\/work\/(\d+)$/);
  if (m && req.method === 'PUT') {
    const b=await req.json();
    await env.DB.prepare(`UPDATE student_work_items SET tariff_id=?,work_date=?,quantity=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(int(b.tariffId),clean(b.workDate)||todayISO(),Math.max(0,int(b.quantity)),clean(b.notes),int(m[1])).run();
    return json({ok:true});
  }
  if (m && req.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM student_work_items WHERE id=?').bind(int(m[1])).run(); return json({ok:true});
  }
  if (req.method === 'GET' && path === '/api/work') {
    const {from,to}=range(url), course=clean(url.searchParams.get('course')), student=clean(url.searchParams.get('student')), repair=clean(url.searchParams.get('repair'));
    const e=await economics(env,{from,to,course,student,repair}); return json(e);
  }

  // EXPENSES (manuali + personale automatico)
  if (req.method === 'GET' && path === '/api/expenses') {
    const {from,to}=range(url), category=clean(url.searchParams.get('category')), search=clean(url.searchParams.get('search')).toLowerCase();
    const manual=(await env.DB.prepare(`SELECT id,expense_date,description,category,supplier,taxable_amount_cents,vat_percent,notes,0 automatic FROM expenses WHERE expense_date BETWEEN ? AND ?`).bind(from,to).all()).results;
    const labor=(await env.DB.prepare(`SELECT h.id,h.work_date expense_date,('Personale · '||e.last_name||' '||e.first_name) description,'Personale' category,'' supplier,(h.minutes*e.hourly_rate_cents/60) taxable_amount_cents,0 vat_percent,h.notes,1 automatic FROM employee_hours h JOIN employees e ON e.id=h.employee_id WHERE h.work_date BETWEEN ? AND ?`).bind(from,to).all()).results;
    const all=[...manual,...labor];
    const categories=[...new Set(all.map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it'));
    const rows=all.filter(x=>(!category||x.category===category)&&(!search||`${x.description||''} ${x.category||''} ${x.supplier||''} ${x.notes||''}`.toLowerCase().includes(search))).sort((a,b)=>b.expense_date.localeCompare(a.expense_date)||Number(b.id)-Number(a.id));
    let net=0,vat=0;for(const x of rows){net+=int(x.taxable_amount_cents);vat+=Math.round(int(x.taxable_amount_cents)*num(x.vat_percent)/100);}
    return json({expenses:rows,categories,totals:{net,vat,total:net+vat}});
  }
  if (req.method === 'POST' && path === '/api/expenses') {
    const b=await req.json(); if(!clean(b.description))return json({error:'Descrizione obbligatoria'},400);
    const r=await env.DB.prepare(`INSERT INTO expenses(expense_date,description,category,supplier,taxable_amount_cents,vat_percent,notes) VALUES(?,?,?,?,?,?,?)`)
      .bind(clean(b.expenseDate)||todayISO(),clean(b.description),clean(b.category)||'Altro',clean(b.supplier),moneyCents(b.taxableAmount),Math.max(0,num(b.vatPercent,22)),clean(b.notes)).run();
    return json({ok:true,id:r.meta.last_row_id});
  }
  m=path.match(/^\/api\/expenses\/(\d+)$/);
  if(m&&req.method==='PUT'){
    const b=await req.json();await env.DB.prepare(`UPDATE expenses SET expense_date=?,description=?,category=?,supplier=?,taxable_amount_cents=?,vat_percent=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(clean(b.expenseDate),clean(b.description),clean(b.category)||'Altro',clean(b.supplier),moneyCents(b.taxableAmount),Math.max(0,num(b.vatPercent,22)),clean(b.notes),int(m[1])).run();return json({ok:true});
  }
  if(m&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM expenses WHERE id=?').bind(int(m[1])).run();return json({ok:true});}

  // EMPLOYEES
  if(req.method==='GET'&&path==='/api/employees'){
    const rows=(await env.DB.prepare(`SELECT e.*,
      COALESCE((SELECT SUM(h.minutes) FROM employee_hours h WHERE h.employee_id=e.id),0) total_minutes,
      COALESCE((SELECT SUM(h.minutes*e.hourly_rate_cents/60) FROM employee_hours h WHERE h.employee_id=e.id),0) accrued_cents,
      COALESCE((SELECT SUM(p.amount_cents) FROM employee_payments p WHERE p.employee_id=e.id),0) paid_cents
      FROM employees e ORDER BY e.active DESC,e.last_name,e.first_name`).all()).results;
    for(const r of rows)r.balance_cents=int(r.accrued_cents)-int(r.paid_cents);
    return json({employees:rows,hourlyRateCents:900});
  }
  if(req.method==='POST'&&path==='/api/employees'){
    const b=await req.json(),first=upper(b.firstName),last=upper(b.lastName);if(!first||!last)return json({error:'Nome e cognome obbligatori'},400);
    const r=await env.DB.prepare(`INSERT INTO employees(first_name,last_name,hourly_rate_cents,notes) VALUES(?,?,900,?)`).bind(first,last,clean(b.notes)).run();return json({ok:true,id:r.meta.last_row_id});
  }
  m=path.match(/^\/api\/employees\/(\d+)$/);
  if(m&&req.method==='PUT'){
    const b=await req.json();await env.DB.prepare(`UPDATE employees SET first_name=?,last_name=?,notes=?,active=?,hourly_rate_cents=900,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(upper(b.firstName),upper(b.lastName),clean(b.notes),b.active===false?0:1,int(m[1])).run();return json({ok:true});
  }
  m=path.match(/^\/api\/employees\/(\d+)\/ledger$/);
  if(m&&req.method==='GET'){
    const id=int(m[1]);const emp=await env.DB.prepare('SELECT * FROM employees WHERE id=?').bind(id).first();if(!emp)return json({error:'Dipendente non trovata'},404);
    const hours=(await env.DB.prepare(`SELECT *,minutes*? / 60 accrued_cents FROM employee_hours WHERE employee_id=? ORDER BY work_date DESC,id DESC`).bind(emp.hourly_rate_cents,id).all()).results;
    const payments=(await env.DB.prepare(`SELECT * FROM employee_payments WHERE employee_id=? ORDER BY payment_date DESC,id DESC`).bind(id).all()).results;
    const totalMinutes=hours.reduce((a,x)=>a+int(x.minutes),0), accrued=hours.reduce((a,x)=>a+int(x.accrued_cents),0), paid=payments.reduce((a,x)=>a+int(x.amount_cents),0);
    return json({employee:emp,hours,payments,summary:{totalMinutes,accruedCents:accrued,paidCents:paid,balanceCents:accrued-paid}});
  }
  m=path.match(/^\/api\/employees\/(\d+)\/hours$/);
  if(m&&req.method==='POST'){
    const b=await req.json(),minutes=Math.max(0,Math.min(1440,Math.round(num(b.hours)*60)));if(minutes<=0)return json({error:'Ore non valide'},400);
    const r=await env.DB.prepare(`INSERT INTO employee_hours(employee_id,work_date,minutes,notes) VALUES(?,?,?,?)`).bind(int(m[1]),clean(b.workDate)||todayISO(),minutes,clean(b.notes)).run();return json({ok:true,id:r.meta.last_row_id});
  }
  m=path.match(/^\/api\/employee-hours\/(\d+)$/);
  if(m&&req.method==='PUT'){
    const b=await req.json(),minutes=Math.max(0,Math.min(1440,Math.round(num(b.hours)*60)));await env.DB.prepare(`UPDATE employee_hours SET work_date=?,minutes=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(clean(b.workDate),minutes,clean(b.notes),int(m[1])).run();return json({ok:true});
  }
  if(m&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM employee_hours WHERE id=?').bind(int(m[1])).run();return json({ok:true});}
  m=path.match(/^\/api\/employees\/(\d+)\/payments$/);
  if(m&&req.method==='POST'){
    const b=await req.json(),amount=moneyCents(b.amount);if(amount<=0)return json({error:'Importo non valido'},400);
    const r=await env.DB.prepare(`INSERT INTO employee_payments(employee_id,payment_date,amount_cents,method,notes) VALUES(?,?,?,?,?)`).bind(int(m[1]),clean(b.paymentDate)||todayISO(),amount,clean(b.method),clean(b.notes)).run();return json({ok:true,id:r.meta.last_row_id});
  }
  m=path.match(/^\/api\/employee-payments\/(\d+)$/);
  if(m&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM employee_payments WHERE id=?').bind(int(m[1])).run();return json({ok:true});}

  // REPORT
  if(req.method==='GET'&&path==='/api/report'){
    const {from,to}=range(url), course=clean(url.searchParams.get('course'));
    const e=await economics(env,{from,to,course});
    const byStudent=new Map(),byRepair=new Map();
    for(const r of e.rows){
      const sk=`${r.student_id}`;if(!byStudent.has(sk))byStudent.set(sk,{student_id:r.student_id,name:`${r.last_name} ${r.first_name}`,course:r.course,quantity:0,gross_cents:0,discount_cents:0,net_cents:0});const s=byStudent.get(sk);s.quantity+=int(r.quantity);s.gross_cents+=int(r.gross_cents);s.discount_cents+=int(r.discount_cents);s.net_cents+=int(r.net_cents);
      const rk=`${r.tariff_id}`;if(!byRepair.has(rk))byRepair.set(rk,{tariff_id:r.tariff_id,garment_type:r.garment_type,repair_code:r.repair_code,description:r.repair_description,quantity:0,gross_cents:0,discount_cents:0,net_cents:0});const rr=byRepair.get(rk);rr.quantity+=int(r.quantity);rr.gross_cents+=int(r.gross_cents);rr.discount_cents+=int(r.discount_cents);rr.net_cents+=int(r.net_cents);
    }
    const emp=(await env.DB.prepare(`SELECT e.id,e.last_name,e.first_name,COALESCE(SUM(h.minutes),0) minutes,COALESCE(SUM(h.minutes*e.hourly_rate_cents/60),0) accrued_cents FROM employees e LEFT JOIN employee_hours h ON h.employee_id=e.id AND h.work_date BETWEEN ? AND ? GROUP BY e.id ORDER BY e.last_name,e.first_name`).bind(from,to).all()).results;
    return json({...e,byStudent:[...byStudent.values()].sort((a,b)=>a.name.localeCompare(b.name)),byRepair:[...byRepair.values()].sort((a,b)=>a.garment_type.localeCompare(b.garment_type)||a.repair_code-b.repair_code),employeeCosts:emp});
  }
  if(req.method==='GET'&&path==='/api/report/work.csv'){
    const {from,to}=range(url),course=clean(url.searchParams.get('course'));const e=await economics(env,{from,to,course});
    const head=['Data','Cognome','Nome','Corso','Capo','Codice','Lavorazione','Quantità','Prezzo unitario listino','Quota ribassabile 10%','Ribasso contrattuale %','Prezzo unitario netto','Totale lordo riga','Ribasso riga','Imponibile netto riga','IVA 22% split payment'];
    const lines=[head.map(csvCell).join(';')];
    for(const r of e.rows){lines.push([r.work_date,r.last_name,r.first_name,r.course,r.garment_type,r.repair_code,r.repair_description,r.quantity,euro(r.taxable_amount_cents),euro4(r.taxable_amount_cents*10),String(e.globalDiscountPercent.toFixed(4)).replace('.',','),euro4(r.unit_net_4),euro(r.gross_cents),euro(r.discount_cents),euro(r.net_cents),euro(r.vat_cents)].map(csvCell).join(';'));}
    return new Response('\ufeff'+lines.join('\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="rendicontazione-${from}-${to}.csv"`}});
  }
  if(req.method==='GET'&&path==='/api/report/employees.csv'){
    const {from,to}=range(url);const rows=(await env.DB.prepare(`SELECT h.work_date,e.last_name,e.first_name,h.minutes,(h.minutes*e.hourly_rate_cents/60) cost_cents,h.notes FROM employee_hours h JOIN employees e ON e.id=h.employee_id WHERE h.work_date BETWEEN ? AND ? ORDER BY h.work_date,e.last_name`).bind(from,to).all()).results;
    const lines=[['Data','Cognome','Nome','Ore','Paga oraria','Costo maturato','Note'].map(csvCell).join(';')];for(const r of rows)lines.push([r.work_date,r.last_name,r.first_name,(r.minutes/60).toFixed(2).replace('.',','),'9,00',euro(r.cost_cents),r.notes].map(csvCell).join(';'));
    return new Response('\ufeff'+lines.join('\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="ore-dipendenti-${from}-${to}.csv"`}});
  }

  return json({error:'Endpoint non trovato'},404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/login') {
      if (!env.ADMIN_PASSWORD) return html(loginPage('Secret ADMIN_PASSWORD non configurato.'),500);
      const form = await req.formData();
      const ok = await safeEqual(clean(form.get('password')), env.ADMIN_PASSWORD);
      if (!ok) return html(loginPage('Password non corretta.'),401);
      const token = await makeSession(env.ADMIN_PASSWORD);
      return redirect('/', { 'set-cookie': `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}` });
    }
    if (url.pathname === '/logout') return redirect('/login', { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });

    const authenticated = await validSession(req, env);
    if (!authenticated) {
      if (url.pathname.startsWith('/api/')) return json({error:'Non autenticato'},401);
      return html(loginPage());
    }

    if (url.pathname.startsWith('/api/')) {
      try { return await handleApi(req, env, url); }
      catch (e) { console.error(e); return json({error:'Errore interno',detail:String(e?.message||e)},500); }
    }

    return env.ASSETS.fetch(req);
  }
};
