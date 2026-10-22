import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { validateTelegramInitData } from './telegram.js';

const app = express();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined });
const port = Number(process.env.PORT || 3001);
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '32kb' }));
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

async function auth(req,res,next) {
  try {
    const identity = validateTelegramInitData(req.get('X-Telegram-Init-Data'), process.env.BOT_TOKEN);
    const q = await pool.query(`INSERT INTO users (telegram_id,username,first_name,photo_url) VALUES ($1,$2,$3,$4)
      ON CONFLICT (telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,photo_url=COALESCE(EXCLUDED.photo_url,users.photo_url),updated_at=NOW()
      RETURNING id,telegram_id,username,first_name,birth_date,age_verification_status,age_verified_at,gender,profile_review_status,account_status,bio,city,photo_url,goal,interests,discoverable`,
      [identity.id,identity.username,identity.firstName,identity.photoUrl]);
    req.user=q.rows[0]; next();
  } catch { res.status(401).json({error:'Telegram authentication failed'}); }
}
function adminOnly(req,res,next) {
  const ids=(process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if (!ids.includes(String(req.user.telegram_id))) return res.status(403).json({error:'Admin access denied'});
  next();
}
app.get('/health',(_req,res)=>res.json({ok:true,app:'vibe-api'}));
app.post('/api/auth/telegram',wrap(async(req,res)=>{
  const i=validateTelegramInitData(req.body?.initData,process.env.BOT_TOKEN);
  const q=await pool.query(`INSERT INTO users (telegram_id,username,first_name,photo_url) VALUES ($1,$2,$3,$4)
    ON CONFLICT (telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,photo_url=COALESCE(EXCLUDED.photo_url,users.photo_url),updated_at=NOW()
    RETURNING id,username,first_name,birth_date,age_verification_status,gender,bio,city,photo_url,goal,interests,discoverable`,[i.id,i.username,i.firstName,i.photoUrl]);
  res.json({user:q.rows[0]});
}));
app.get('/api/me',auth,(req,res)=>res.json({user:req.user}));
app.put('/api/me',auth,wrap(async(req,res)=>{
  const {birthDate,gender=null,bio='',city=null,photoUrl=null,goal='friendship',interests=[]}=req.body||{};
  if(typeof bio!=='string'||bio.length>500||!['friendship','chat','relationship','both'].includes(goal)||!Array.isArray(interests)||interests.length>20) return res.status(400).json({error:'Invalid profile'});
  if(gender!==null&&!['woman','man','nonbinary','prefer_not_to_say'].includes(gender)) return res.status(400).json({error:'Invalid gender'});
  const d=birthDate?new Date(birthDate+'T00:00:00Z'):null;
  if(birthDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==birthDate||d>new Date())) return res.status(400).json({error:'Invalid birth date'});
  const q=await pool.query(`UPDATE users SET birth_date=$1,age_confirmed=$2,gender=$3,bio=$4,city=$5,photo_url=$6,goal=$7,interests=$8,updated_at=NOW()
    WHERE id=$9 RETURNING id,username,first_name,birth_date,age_verification_status,gender,bio,city,photo_url,goal,interests,discoverable`,
    [birthDate||null,Boolean(birthDate),gender,bio,city,photoUrl,goal,interests,req.user.id]);
  const age=d?Math.floor((Date.now()-d.getTime())/31557600000):null;
  res.json({user:q.rows[0],route:age===null?'age_gate':age<18?'youth':'adult_verification',adultAccess:false});
}));
app.get('/api/age-status',auth,wrap(async(req,res)=>{
  const q=await pool.query('SELECT birth_date,verified_birth_date,age_verification_status FROM users WHERE id=$1',[req.user.id]);
  const u=q.rows[0]; const d=u.verified_birth_date?new Date(u.verified_birth_date):null;
  const age=d?Math.floor((Date.now()-d.getTime())/31557600000):null;
  const adultAccess=u.age_verification_status==='verified'&&age!==null&&age>=18;
  res.json({route:!u.birth_date?'age_gate':new Date(u.birth_date).getTime()>Date.now()-18*31557600000?'youth':adultAccess?'adult':'adult_verification',adultAccess,status:u.age_verification_status});
}));
app.get('/api/discover',auth,wrap(async(req,res)=>{
  const q=await pool.query(`SELECT u.id,u.first_name AS name,u.bio,u.city,u.photo_url,u.goal,u.interests FROM users u
    WHERE u.id<>$1 AND u.discoverable=TRUE AND u.verified_birth_date IS NOT NULL AND u.verified_birth_date<=CURRENT_DATE-INTERVAL '18 years'
    AND u.age_verification_status='verified' AND u.account_status='active' AND u.profile_review_status<>'restricted'
    AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
    AND NOT EXISTS(SELECT 1 FROM likes l WHERE l.from_user=$1 AND l.to_user=u.id) ORDER BY u.created_at DESC LIMIT 50`,[req.user.id]);
  res.json({people:q.rows});
}));
app.post('/api/likes/:userId',auth,wrap(async(req,res)=>{
  const id=Number(req.params.userId); if(!Number.isSafeInteger(id)||id===req.user.id)return res.status(400).json({error:'Invalid user'});
  const q=await pool.query(`SELECT id FROM users WHERE id=$1 AND age_verification_status='verified' AND verified_birth_date<=CURRENT_DATE-INTERVAL '18 years' AND account_status='active'`,[id]);
  if(!q.rowCount)return res.status(404).json({error:'User unavailable'});
  await pool.query('INSERT INTO likes(from_user,to_user) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,id]);
  const m=await pool.query('SELECT 1 FROM likes WHERE from_user=$1 AND to_user=$2',[id,req.user.id]); res.json({liked:true,matched:!!m.rowCount});
}));
app.get('/api/chats',auth,wrap(async(req,res)=>{
  const q=await pool.query(`SELECT u.id AS user_id,u.first_name,u.photo_url,
    (SELECT m.body FROM messages m WHERE m.match_low=LEAST($1,u.id) AND m.match_high=GREATEST($1,u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message,
    (SELECT m.created_at FROM messages m WHERE m.match_low=LEAST($1,u.id) AND m.match_high=GREATEST($1,u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
    FROM likes mine JOIN likes theirs ON theirs.from_user=mine.to_user AND theirs.to_user=mine.from_user
    JOIN users u ON u.id=mine.to_user
    WHERE mine.from_user=$1 AND u.account_status='active'
    ORDER BY last_message_at DESC NULLS LAST,u.first_name ASC`,[req.user.id]);
  res.json({chats:q.rows});
}));
app.get('/api/chats/:userId/messages',auth,wrap(async(req,res)=>{
  const other=Number(req.params.userId);
  if(!Number.isSafeInteger(other)||other===Number(req.user.id))return res.status(400).json({error:'Invalid user'});
  const match=await pool.query(`SELECT 1 FROM likes a JOIN likes b ON b.from_user=a.to_user AND b.to_user=a.from_user WHERE a.from_user=$1 AND a.to_user=$2`,[req.user.id,other]);
  if(!match.rowCount)return res.status(403).json({error:'Чат доступен только при взаимной симпатии'});
  const q=await pool.query(`SELECT id,sender_id,body,created_at FROM messages WHERE match_low=LEAST($1,$2) AND match_high=GREATEST($1,$2) ORDER BY created_at ASC LIMIT 200`,[req.user.id,other]);
  res.json({messages:q.rows});
}));
app.post('/api/chats/:userId/messages',auth,wrap(async(req,res)=>{
  const other=Number(req.params.userId); const body=req.body?.body;
  if(!Number.isSafeInteger(other)||other===Number(req.user.id)||typeof body!=='string'||!body.trim()||body.trim().length>4000)return res.status(400).json({error:'Некорректное сообщение'});
  const match=await pool.query(`SELECT 1 FROM likes a JOIN likes b ON b.from_user=a.to_user AND b.to_user=a.from_user WHERE a.from_user=$1 AND a.to_user=$2`,[req.user.id,other]);
  if(!match.rowCount)return res.status(403).json({error:'Чат доступен только при взаимной симпатии'});
  const q=await pool.query(`INSERT INTO messages(match_low,match_high,sender_id,body) VALUES(LEAST($1,$2),GREATEST($1,$2),$1,$3) RETURNING id,sender_id,body,created_at`,[req.user.id,other,body.trim()]);
  res.status(201).json({message:q.rows[0]});
}));
app.post('/api/blocks/:userId',auth,wrap(async(req,res)=>{
  const id=Number(req.params.userId); if(!Number.isSafeInteger(id)||id===req.user.id)return res.status(400).json({error:'Invalid user'});
  await pool.query('INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,id]);
  await pool.query('DELETE FROM likes WHERE (from_user=$1 AND to_user=$2) OR (from_user=$2 AND to_user=$1)',[req.user.id,id]);res.json({blocked:true});
}));
app.post('/api/reports/:userId',auth,wrap(async(req,res)=>{
  const id=Number(req.params.userId); const {reason,details=''}=req.body||{};
  if(!Number.isSafeInteger(id)||id===req.user.id||typeof reason!=='string'||reason.length>100||typeof details!=='string'||details.length>1000)return res.status(400).json({error:'Invalid report'});
  await pool.query('INSERT INTO reports(reporter_id,reported_id,reason,details) VALUES($1,$2,$3,$4)',[req.user.id,id,reason,details]);res.status(201).json({reported:true});
}));
app.get('/api/admin/queue',auth,adminOnly,wrap(async(_req,res)=>{
  const [reports,flags]=await Promise.all([
    pool.query(`SELECT r.id,r.reporter_id, a.first_name reporter_name,r.reported_id,t.first_name reported_name,r.reason,r.details,r.status,r.created_at,t.username reported_username,t.account_status,t.profile_review_status,t.photo_url,t.bio FROM reports r JOIN users a ON a.id=r.reporter_id JOIN users t ON t.id=r.reported_id WHERE r.status IN ('open','reviewing') ORDER BY r.created_at ASC LIMIT 200`),
    pool.query(`SELECT f.id,f.user_id,u.first_name,u.username,u.photo_url,u.bio,f.category,f.reason,f.evidence,f.status,f.created_at,u.account_status,u.profile_review_status FROM moderation_flags f JOIN users u ON u.id=f.user_id WHERE f.status IN ('open','reviewing') ORDER BY f.created_at ASC LIMIT 200`)
  ]);res.json({reports:reports.rows,flags:flags.rows});
}));
app.patch('/api/admin/reports/:id',auth,adminOnly,wrap(async(req,res)=>{
  const id=Number(req.params.id);const {status,action='none',note=''}=req.body||{};
  if(!Number.isSafeInteger(id)||!['reviewing','resolved','dismissed'].includes(status)||!['none','restrict','suspend','ban','restore'].includes(action))return res.status(400).json({error:'Invalid action'});
  const c=await pool.connect();try{await c.query('BEGIN');const f=await c.query('SELECT reported_id FROM reports WHERE id=$1 FOR UPDATE',[id]);if(!f.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Report not found'});}
  await c.query('UPDATE reports SET status=$1 WHERE id=$2',[status,id]);if(action!=='none'){const s={restrict:'restricted',suspend:'suspended',ban:'banned',restore:'active'}[action];await c.query(`UPDATE users SET account_status=$1,moderation_note=$2,discoverable=CASE WHEN $1='active' THEN discoverable ELSE FALSE END,updated_at=NOW() WHERE id=$3`,[s,note||'Admin action: '+action,f.rows[0].reported_id]);}await c.query('COMMIT');res.json({updated:true});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
app.patch('/api/admin/flags/:id',auth,adminOnly,wrap(async(req,res)=>{
  const id=Number(req.params.id);const {status,action='none',note=''}=req.body||{};
  if(!Number.isSafeInteger(id)||!['reviewing','resolved','dismissed'].includes(status)||!['none','restrict','suspend','ban','restore'].includes(action))return res.status(400).json({error:'Invalid action'});
  const f=await pool.query('UPDATE moderation_flags SET status=$1 WHERE id=$2 RETURNING user_id',[status,id]);if(!f.rowCount)return res.status(404).json({error:'Flag not found'});
  if(action!=='none'){const s={restrict:'restricted',suspend:'suspended',ban:'banned',restore:'active'}[action];await pool.query('UPDATE users SET account_status=$1,moderation_note=$2,discoverable=CASE WHEN $1=\'active\' THEN discoverable ELSE FALSE END,updated_at=NOW() WHERE id=$3',[s,note||'Admin action: '+action,f.rows[0].user_id]);}res.json({updated:true});
}));

app.post('/telegram/webhook', (req,res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.get('X-Telegram-Bot-Api-Secret-Token') !== secret) return res.sendStatus(401);
  res.sendStatus(200);
  const message = req.body?.message;
  if (!message?.chat?.id || typeof message.text !== 'string') return;
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  (async () => {
    const telegramUser = message.from;
    const command = message.text.trim().split(/\\s+/)[0].split('@')[0].toLowerCase();
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
    const isAdmin = adminIds.includes(String(telegramUser?.id));
    let reply;
    let replyMarkup;
    if (command === '/start') {
      if (telegramUser?.id && telegramUser?.first_name) {
        await pool.query(
          `INSERT INTO users (telegram_id,username,first_name) VALUES ($1,$2,$3)
           ON CONFLICT (telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,updated_at=NOW()`,
          [String(telegramUser.id), telegramUser.username ?? null, telegramUser.first_name]
        );
      }
      reply = 'Привет! Это VIBE ✨ Нажми кнопку ниже, чтобы открыть приложение.';
      replyMarkup = { inline_keyboard: [[{ text: 'Открыть VIBE ✨', web_app: { url: 'https://vibe-client-sroc.onrender.com' } }]] };
    } else if (['/адм', '/admin'].includes(command)) {
      if (!isAdmin) {
        reply = '⛔ Команда доступна только администраторам.';
      } else {
        reply = '🛡️ VIBE — меню администратора\\n\\n/очередь — проверить жалобы и флаги модерации\\n/сайт — открыть приложение\\n/адм — показать это меню';
        replyMarkup = { keyboard: [[{ text: '/очередь' }, { text: '/адм' }], [{ text: '/сайт' }]], resize_keyboard: true };
      }
    } else if (command === '/очередь') {
      if (!isAdmin) {
        reply = '⛔ Команда доступна только администраторам.';
      } else {
        const [reports, flags] = await Promise.all([
          pool.query("SELECT COUNT(*)::int AS count FROM reports WHERE status IN ('open','reviewing')"),
          pool.query("SELECT COUNT(*)::int AS count FROM moderation_flags WHERE status IN ('open','reviewing')")
        ]);
        reply = '📋 Очередь модерации\\nЖалобы: ' + reports.rows[0].count + '\\nФлаги: ' + flags.rows[0].count + '\\n\\nПолная обработка доступна через API администратора.';
        replyMarkup = { keyboard: [[{ text: '/адм' }, { text: '/сайт' }]], resize_keyboard: true };
      }
    } else if (command === '/сайт') {
      reply = 'Открывай VIBE ✨';
      replyMarkup = { inline_keyboard: [[{ text: 'Открыть VIBE ✨', web_app: { url: 'https://vibe-client-sroc.onrender.com' } }]] };
    } else if (command === '/help' || command === '/помощь') {
      reply = 'Команды VIBE:\\n/start — открыть приложение\\n/help — помощь';
    } else {
      return;
    }
    const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: message.chat.id, text: reply, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) })
    });
    if (!response.ok) console.error('Telegram reply failed:', response.status);
  })().catch(err => console.error('Telegram webhook processing failed:', err.message));
});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Internal server error'});});
async function start() {
  try {
    // Create VIBE tables in the configured VIBE database; CREATE IF NOT EXISTS preserves existing rows.
    const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
    await pool.query(schema);
    console.log('VIBE database schema ready');
  } catch (err) {
    console.error('VIBE database schema initialization failed:', err.message);
  }
  app.listen(port, () => {
    console.log('VIBE API listening on ' + port);
    const token = process.env.BOT_TOKEN;
    if (token) {
      fetch('https://api.telegram.org/bot' + token + '/setWebhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://znakomstva-824i.onrender.com/telegram/webhook' })
      }).then(r => r.json()).then(result => console.log('Telegram webhook setup:', result.ok ? 'ok' : result.description))
        .catch(err => console.error('Telegram webhook setup failed:', err.message));
    } else {
      console.error('BOT_TOKEN is missing; Telegram bot is disabled');
    }
  });
}
start();
