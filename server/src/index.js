import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { validateTelegramInitData } from './telegram.js';
import { EXTRA_ADMIN_COMMANDS, handleExtraAdminCommand } from './admin-commands.js';

const app = express();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined });
const port = Number(process.env.PORT || 3001);
const DEVELOPER_TELEGRAM_ID = '8745499515';
const ROLE_LABELS = { developer: 'Разработчик', chief_admin: 'Главный администратор', admin: 'Администратор', moderator: 'Модератор', helper: 'Помощник' };
const PUBLIC_STATUS_LABELS = { chief_admin: 'Главный администратор', admin: 'Администратор', moderator: 'Модератор', helper: 'Помощник' };
const BAN_REASONS = {
  spam: { label: 'Спам и навязчивая реклама', reason: 'Спам, массовые сообщения или навязчивая реклама' },
  scam: { label: 'Мошенничество и обман', reason: 'Мошенничество, фишинг или попытка обмана пользователей' },
  harassment: { label: 'Травля, оскорбления или угрозы', reason: 'Травля, систематические оскорбления или угрозы пользователям' },
  hate: { label: 'Ненависть и дискриминация', reason: 'Разжигание ненависти или дискриминация по защищённым признакам' },
  sexual: { label: 'Сексуальные домогательства', reason: 'Сексуальные домогательства, непрошеные откровенные материалы или сексуальная эксплуатация' },
  minor: { label: 'Возрастные ограничения или обман о возрасте', reason: 'Нарушение возрастных ограничений или предоставление ложных сведений о возрасте' },
  fake: { label: 'Фейковая анкета или выдача себя за другого', reason: 'Поддельная анкета, выдача себя за другого человека или использование чужих фотографий без разрешения' },
  explicit: { label: 'Запрещённые фото или видео', reason: 'Публикация запрещённых, откровенных, шокирующих или насильственных фото и видео' },
  privacy: { label: 'Публикация личных данных', reason: 'Публикация личных данных, переписок или изображений без согласия; доксинг' },
  illegal: { label: 'Опасная или незаконная деятельность', reason: 'Продвижение незаконной деятельности, угрозы физической расправой или призывы к насилию' },
  manipulation: { label: 'Боты и манипуляции платформой', reason: 'Использование ботов, фальшивых аккаунтов или манипуляция лайками и функциями VIBE' },
  evasion: { label: 'Обход бана или повторные нарушения', reason: 'Обход ранее выданной блокировки или повторные нарушения правил VIBE' },
  reports: { label: 'Злоупотребление жалобами', reason: 'Заведомо ложные жалобы или систематическое злоупотребление системой жалоб' },
  other: { label: 'Другое подтверждённое нарушение правил', reason: 'Другое подтверждённое нарушение правил VIBE' }
};

function telegramCommandsForRole(role) {
  const publicCommands = [
    { command: 'start', description: 'Открыть приложение VIBE' },
    { command: 'help', description: 'Справка и доступные команды' },
    { command: 'status', description: 'Проверить состояние сервиса' }
  ];
  const adminCommands = [...publicCommands,
    { command: 'admin', description: 'Открыть панель администратора' },
    { command: 'queue', description: 'Очередь модерации' },
    { command: 'users', description: 'Количество пользователей' },
    { command: 'bans', description: 'Список заблокированных аккаунтов' },
    { command: 'user', description: 'Карточка пользователя' },
    { command: 'ban', description: 'Заблокировать аккаунт' },
    { command: 'unban', description: 'Снять блокировку аккаунта' },
    { command: 'delete', description: 'Удалить аккаунт' },
    ...EXTRA_ADMIN_COMMANDS
  ];
  if (role === 'developer') return [...adminCommands,
    { command: 'publicstatus', description: 'Установить публичный статус профиля' },
    { command: 'clearstatus', description: 'Убрать публичный статус профиля' }
  ];
  return roleRank[role] >= roleRank.admin ? adminCommands : publicCommands;
}

async function refreshTelegramCommands(chatId, role, token) {
  const commands = telegramCommandsForRole(role);
  const scope = { type: 'chat', chat_id: Number(chatId) };
  const results = await Promise.all([
    fetch('https://api.telegram.org/bot' + token + '/setMyCommands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commands, scope })
    }).then(r => r.json()),
    fetch('https://api.telegram.org/bot' + token + '/setMyCommands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commands, scope, language_code: 'ru' })
    }).then(r => r.json())
  ]);
  const failed = results.filter(result => !result.ok);
  if (failed.length) console.error('Telegram chat command menu refresh failed:', String(chatId), role, failed.map(result => result.description).join('; '));
  else console.log('Telegram chat command menu refreshed:', String(chatId), role, commands.length, 'commands; default and ru scopes');
}
// Public profile badges are independent from admin_roles permissions.
const roleRank = { none: 0, helper: 1, moderator: 2, admin: 3, chief_admin: 4, developer: 5 };
async function notifyDeveloperAttempt({actorId,actorName,actorUsername,action,source}) {
  if (!process.env.BOT_TOKEN) return;
  const text = 'VIBE | СИСТЕМА БЕЗОПАСНОСТИ\nЗарегистрирована заблокированная попытка действия в отношении разработчика.\nДействие: ' + action + '\nКто пытался: ' + (actorUsername ? '@' + actorUsername : (actorName || 'неизвестно')) + (actorUsername && actorName ? ' (' + actorName + ')' : '') + '\nИсточник: ' + source + '\nРезультат: действие заблокировано системой безопасности VIBE.';
  try {
    const r = await fetch('https://api.telegram.org/bot' + process.env.BOT_TOKEN + '/sendMessage', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({chat_id:DEVELOPER_TELEGRAM_ID,text}) });
    if (!r.ok) console.error('Developer protection notification failed:', await r.text());
  } catch (e) { console.error('Developer protection notification failed:', e.message); }
}
async function getRole(telegramId) {
  if (String(telegramId) === DEVELOPER_TELEGRAM_ID) return 'developer';
  const q = await pool.query('SELECT role FROM admin_roles WHERE telegram_id=$1', [String(telegramId)]);
  if (q.rowCount) return q.rows[0].role;
  if ((process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(x => x.trim()).includes(String(telegramId))) return 'admin';
  return 'none';
}
async function canManage(req,res,next) {
  try { const role = await getRole(req.user.telegram_id); if (roleRank[role] < roleRank.admin) return res.status(403).json({error:'Admin access denied'}); req.adminRole=role; next(); }
  catch (e) { next(e); }
}
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '5mb' }));
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

async function auth(req,res,next) {
  try {
    const identity = validateTelegramInitData(req.get('X-Telegram-Init-Data'), process.env.BOT_TOKEN);
    const q = await pool.query(`INSERT INTO users (telegram_id,username,first_name,photo_url) VALUES ($1,$2,$3,$4)
      ON CONFLICT (telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,photo_url=COALESCE(EXCLUDED.photo_url,users.photo_url),updated_at=NOW()
      RETURNING id,telegram_id,username,first_name,birth_date,age_verification_status,age_verified_at,gender,profile_review_status,account_status,bio,city,photo_url,goal,interests,discoverable,moderation_note,public_status,ban_issuer`,
      [identity.id,identity.username,identity.firstName,identity.photoUrl]);
    req.user=q.rows[0];
    if (req.user.account_status === 'banned') {
      return res.status(403).json({ error: 'Ваш аккаунт забанен', banned: true, reason: req.user.moderation_note || 'Причина не указана', moderation_note: req.user.moderation_note || '', ban_issuer: req.user.ban_issuer || 'moderator', ban_issuer_label: (req.user.ban_issuer || 'moderator') === 'developer' ? 'разработчиком' : 'модератором' });
    }
    if (['suspended','restricted'].includes(req.user.account_status)) {
      return res.status(403).json({ error: 'Доступ к аккаунту ограничен', restricted: true, reason: req.user.moderation_note || 'Причина не указана' });
    }
    next();
  } catch { res.status(401).json({error:'Telegram authentication failed'}); }
}
const adminOnly = canManage;
app.get('/health',(_req,res)=>{const maintenance=String(process.env.MAINTENANCE_MODE||'').toLowerCase()==='true';res.status(maintenance?503:200).json({ok:!maintenance,status:maintenance?'maintenance':'online',app:'vibe-api',message:maintenance?(process.env.MAINTENANCE_MESSAGE||'Проводятся технические работы. Попробуйте позже.'): 'Сервер работает нормально'});});

app.post('/api/auth/telegram',wrap(async(req,res)=>{
  const i=validateTelegramInitData(req.body?.initData,process.env.BOT_TOKEN);
  const q=await pool.query(`INSERT INTO users (telegram_id,username,first_name,photo_url) VALUES ($1,$2,$3,$4)
    ON CONFLICT (telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,photo_url=COALESCE(EXCLUDED.photo_url,users.photo_url),updated_at=NOW()
    RETURNING id,username,first_name,birth_date,age_verification_status,gender,bio,city,photo_url,goal,interests,discoverable,account_status,moderation_note`,[i.id,i.username,i.firstName,i.photoUrl]);
  const u = q.rows[0];
  if (u.account_status === 'banned') return res.status(403).json({ error: 'Ваш аккаунт забанен', banned: true, reason: u.moderation_note || 'Причина не указана', moderation_note: u.moderation_note || '' });
  if (['suspended','restricted'].includes(u.account_status)) return res.status(403).json({ error: 'Доступ к аккаунту ограничен', restricted: true, reason: u.moderation_note || 'Причина не указана' });
  res.json({user:u});
}));
app.get('/api/me',auth,wrap(async(req,res)=>{const [r,likes]=await Promise.all([pool.query('SELECT role FROM admin_roles WHERE telegram_id=$1',[String(req.user.telegram_id)]),pool.query('SELECT COUNT(*)::int AS count FROM likes WHERE to_user=$1',[req.user.id])]);const role=String(req.user.telegram_id)===DEVELOPER_TELEGRAM_ID?'developer':(r.rows[0]?.role||'none');const status=String(req.user.telegram_id)===DEVELOPER_TELEGRAM_ID?'developer':(req.user.public_status||'none');res.json({user:{...req.user,account_code:String(req.user.id).padStart(6,'0'),likes_received:likes.rows[0]?.count||0,admin_access:roleRank[role]>=roleRank.admin,public_role:status,role_label:status==='developer'?'Разработчик':(PUBLIC_STATUS_LABELS[status]||null)}});}));
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

async function getUserAgeBand(userId) {
  const q = await pool.query('SELECT birth_date,verified_birth_date,age_verification_status FROM users WHERE id=$1 AND account_status=\'active\'', [userId]);
  if (!q.rowCount) return 'restricted';
  const u = q.rows[0];
  const today = new Date();
  const ageOn = value => {
    if (!value) return null;
    const d = new Date(String(value).slice(0,10) + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) return null;
    let age = today.getUTCFullYear() - d.getUTCFullYear();
    if (today.getUTCMonth() < d.getUTCMonth() || (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate())) age--;
    return age;
  };
  const selfReportedAge = ageOn(u.birth_date);
  if (selfReportedAge !== null && selfReportedAge >= 14 && selfReportedAge <= 17) return 'teen';
  const verifiedAge = ageOn(u.verified_birth_date);
  if (u.age_verification_status === 'verified' && verifiedAge !== null && verifiedAge >= 18) return 'adult';
  return 'restricted';
}

app.get('/api/age-status',auth,wrap(async(req,res)=>{
  const q=await pool.query('SELECT birth_date,verified_birth_date,age_verification_status FROM users WHERE id=$1',[req.user.id]);
  const u=q.rows[0]; const d=u.verified_birth_date?new Date(u.verified_birth_date):null;
  const age=d?Math.floor((Date.now()-d.getTime())/31557600000):null;
  const adultAccess=u.age_verification_status==='verified'&&age!==null&&age>=18;
  const selfAge=u.birth_date?Math.floor((Date.now()-new Date(u.birth_date).getTime())/31557600000):null;
  const ageBand=selfAge!==null&&selfAge>=14&&selfAge<18?'teen':adultAccess?'adult':'restricted';
  res.json({route:!u.birth_date?'age_gate':selfAge!==null&&selfAge<14?'underage':ageBand==='teen'?'teen':adultAccess?'adult':'adult_verification',ageBand,adultAccess,status:u.age_verification_status});
}));

const bannedProfileTerms=['fuck','shit','bitch','asshole','cunt','dick','pussy','cock','whore','slut','porn','nude','ебать','ебу','ебал','ебан','ёбан','бляд','бля','сука','сучка','хуй','хуя','хуе','пизд','мудил','гандон','залуп','шлюх','секс','порно','дроч','насил','scheisse','scheiß','fick','ficken','arschloch','hure','schlampe','wichser','hurensohn','putain','merde','connard','puta','joder','mierda','cazzo','kurwa','chuj','pizda','blyat','suka','cyka','hui','pizdec','pidor','pidaras','zaeb','nahui','huy','huylo'];
function profileTextProblem(values){
 const text=values.filter(v=>typeof v==='string').join(' ').normalize('NFKC').toLocaleLowerCase();
 const compact=text.replace(/[\s._*\-+!@#$%^&()\[\]{}:;'"~`/\\|]+/g,'');
 return bannedProfileTerms.some(term=>text.includes(term)||compact.includes(term.replace(/[^a-zа-яё]/gi,'')));
}
app.get('/api/listings/mine',auth,wrap(async(req,res)=>{
 const q=await pool.query(`SELECT l.user_id AS id,l.name,l.age,l.city,l.country,l.hobbies,l.description,l.media_url,l.media_type,l.status,l.created_at,l.updated_at,l.id AS listing_id FROM listings l WHERE l.user_id=$1`,[req.user.id]);
 res.json({listing:q.rows[0]||null});
}));
app.post('/api/listings',auth,wrap(async(req,res)=>{
 const {name,age,city,country,hobbies='',description='',mediaUrl=null,mediaType='image'}=req.body||{};
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>60)return res.status(400).json({error:'Имя должно содержать от 2 до 60 символов.'});
 if(!Number.isInteger(Number(age))||Number(age)<14||Number(age)>100)return res.status(400).json({error:'Возраст указывается числом от 14 до 100.'});
 const authorBand=await getUserAgeBand(req.user.id);
 if(!['teen','adult'].includes(authorBand))return res.status(403).json({error:'Сначала укажи дату рождения и подтверди возраст от 14 лет.'});
 if((authorBand==='teen'&&Number(age)>17)||(authorBand==='adult'&&Number(age)<18))return res.status(403).json({error:'Возраст анкеты не соответствует твоей возрастной стороне VIBE.'});
 if(typeof city!=='string'||city.trim().length<2||city.trim().length>80||typeof country!=='string'||country.trim().length<2||country.trim().length>80)return res.status(400).json({error:'Укажи город и страну.'});
 if(typeof hobbies!=='string'||hobbies.length>300||typeof description!=='string'||description.length>1000)return res.status(400).json({error:'Хобби — до 300, описание — до 1000 символов.'});
 if(mediaUrl!==null&&(typeof mediaUrl!=='string'||mediaUrl.length>4400000||!(mediaUrl.startsWith('data:image/')||mediaUrl.startsWith('data:video/'))))return res.status(400).json({error:'Медиа должно быть фото или видео размером до 3 МБ.'});
 if(!['image','video'].includes(mediaType))return res.status(400).json({error:'Некорректный тип медиа.'});
 if(mediaUrl&&((mediaType==='video'&&!mediaUrl.startsWith('data:video/'))||(mediaType==='image'&&!mediaUrl.startsWith('data:image/'))))return res.status(400).json({error:'Тип файла не совпадает с выбранным типом медиа.'});
 if(profileTextProblem([name,city,country,hobbies,description]))return res.status(400).json({error:'В анкете найдены запрещённые ругательства или пошлые слова. Исправь текст.'});
 const q=await pool.query(`INSERT INTO listings(user_id,name,age,city,country,hobbies,description,media_url,media_type,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
 ON CONFLICT(user_id) DO UPDATE SET name=EXCLUDED.name,age=EXCLUDED.age,city=EXCLUDED.city,country=EXCLUDED.country,hobbies=EXCLUDED.hobbies,description=EXCLUDED.description,media_url=EXCLUDED.media_url,media_type=EXCLUDED.media_type,status='pending',updated_at=NOW()
 RETURNING id,user_id,name,age,city,country,hobbies,description,media_url,media_type,status,created_at,updated_at`,[req.user.id,name.trim(),Number(age),city.trim(),country.trim(),hobbies.trim(),description.trim(),mediaUrl,mediaType]);
 const listing=q.rows[0];
 if(process.env.BOT_TOKEN){
   try {
     const admins=await pool.query("SELECT telegram_id FROM admin_roles WHERE role IN ('chief_admin','admin')");
     const ids=new Set([DEVELOPER_TELEGRAM_ID,...(process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean),...admins.rows.map(x=>String(x.telegram_id))]);
     const author=await pool.query('SELECT telegram_id,username,first_name,photo_url,created_at FROM users WHERE id=$1',[req.user.id]);
     const u=author.rows[0];
     const code=String(req.user.id).padStart(6,'0');
     const created=new Date(listing.created_at).toLocaleString('ru-RU',{timeZone:'Europe/Berlin'});
     const escapeHtml = value => String(value ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     const cleanDisplay = value => String(value || '').replace(/[\u200B-\u200F\uFEFF\u2060]/g, '').trim();
     const displayName = cleanDisplay(u?.first_name) || 'Не указано';
     const displayUsername = cleanDisplay(u?.username);
     const details = [
       '🆕 <b>НОВАЯ АНКЕТА — VIBE</b>',
       '━━━━━━━━━━━━━━━━',
       '🆔 <b>Номер анкеты:</b> #' + listing.id,
       '',
       '👤 <b>Данные анкеты</b>',
       '• <b>Имя:</b> ' + escapeHtml(listing.name),
       '• <b>Возраст:</b> ' + listing.age,
       '• <b>Город:</b> ' + escapeHtml(listing.city) + ', ' + escapeHtml(listing.country),
       '• <b>Хобби:</b> ' + escapeHtml(listing.hobbies || '—'),
       '• <b>Описание:</b> ' + escapeHtml(listing.description || '—'),
       '',
       '🪪 <b>Аккаунт</b>',
       '• <b>Код VIBE:</b> <code>' + escapeHtml(code) + '</code>',
       '• <b>Пользователь:</b> ' + escapeHtml(displayName) + (displayUsername ? ' (@' + escapeHtml(displayUsername) + ')' : ''),
       '• <b>Создано:</b> ' + escapeHtml(created),
       '• <b>Фото профиля:</b> ' + (u?.photo_url ? 'есть' : 'нет'),
       '',
       '👇 <b>Проверь анкету и выбери действие:</b>'
     ].join('\n');
     const keyboard={inline_keyboard:[[{text:'✅ Одобрить',callback_data:'l:approve:'+listing.id},{text:'❌ Отклонить',callback_data:'l:reject:'+listing.id}]]};
     await Promise.all([...ids].map(async chatId=>{
       if(u?.photo_url){
         try {
           const endpoint='https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/sendPhoto';
           if(u.photo_url.startsWith('http://') || u.photo_url.startsWith('https://')) {
             await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,photo:u.photo_url,caption:'Фото анкеты #'+listing.id})});
           } else {
             const encoded=u.photo_url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
             if(encoded){const form=new FormData();form.append('chat_id',String(chatId));form.append('photo',new Blob([Buffer.from(encoded[2],'base64')],{type:encoded[1]}),'listing-photo');await fetch(endpoint,{method:'POST',body:form});}
           }
         } catch(e) { console.error('Listing photo notification failed:',e.message); }
       }
       return fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:details,parse_mode:'HTML',reply_markup:keyboard})}).catch(e=>console.error('Listing notification failed:',e.message));
     }));
   } catch(e) { console.error('Listing moderation notification failed:',e.message); }
 }
 res.status(201).json({listing});
}));
app.get('/api/discover',auth,wrap(async(req,res)=>{
   const viewerBand=await getUserAgeBand(req.user.id);
   if(!['teen','adult'].includes(viewerBand))return res.json({people:[]});
   const q=await pool.query(`
     WITH viewer AS (
       SELECT city, verified_birth_date, goal, interests
       FROM users WHERE id=$1
     ),
     candidates AS (
       SELECT l.user_id AS id,l.id AS listing_id,l.user_id,l.name,l.age,l.city,l.country,l.hobbies,l.description,l.media_url,l.media_type,l.status,l.created_at,u.photo_url,u.username,
         CASE WHEN u.telegram_id::text=$2 THEN 'developer' ELSE COALESCE(NULLIF(u.public_status,''),'none') END AS public_role,
         (
           CASE WHEN NULLIF(TRIM(viewer.city),'') IS NOT NULL
                  AND LOWER(TRIM(COALESCE(l.city,'')))=LOWER(TRIM(viewer.city)) THEN 10 ELSE 0 END
           + CASE WHEN COALESCE(viewer.goal,'both')='both'
                    OR COALESCE(u.goal,'both')='both'
                    OR COALESCE(viewer.goal,'both')=COALESCE(u.goal,'both') THEN 4 ELSE 0 END
           + (
             SELECT COUNT(*) * 3
             FROM unnest(COALESCE(viewer.interests, ARRAY[]::text[])) AS vi(value)
             WHERE TRIM(vi.value) <> ''
               AND (
                 EXISTS (SELECT 1 FROM unnest(COALESCE(u.interests, ARRAY[]::text[])) AS ui(value)
                         WHERE LOWER(TRIM(ui.value))=LOWER(TRIM(vi.value)))
                 OR EXISTS (SELECT 1 FROM regexp_split_to_table(COALESCE(l.hobbies,''), ',') AS lh(value)
                            WHERE LOWER(TRIM(lh.value))=LOWER(TRIM(vi.value)))
               )
           )
           + CASE WHEN viewer.verified_birth_date IS NOT NULL
                    THEN GREATEST(0, 5 - FLOOR(ABS(l.age - EXTRACT(YEAR FROM AGE(CURRENT_DATE, viewer.verified_birth_date))) / 5)::int)
                    ELSE 0 END
         ) AS match_score
       FROM listings l
       JOIN users u ON u.id=l.user_id
       CROSS JOIN viewer
       WHERE (l.status='published' OR l.user_id=$1)
         AND u.account_status='active'
         AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
         AND (l.user_id=$1 OR (l.status='published' AND (
           ($3='teen' AND u.birth_date > CURRENT_DATE-INTERVAL '18 years' AND u.birth_date <= CURRENT_DATE-INTERVAL '14 years')
           OR ($3='adult' AND u.age_verification_status='verified' AND u.verified_birth_date<=CURRENT_DATE-INTERVAL '18 years')
         )))
     )
     SELECT * FROM candidates
     ORDER BY CASE WHEN user_id=$1 THEN 0 ELSE 1 END, match_score DESC, RANDOM()
     LIMIT 50
   `,[req.user.id,DEVELOPER_TELEGRAM_ID,viewerBand]);
   res.json({people:q.rows.map(p=>({...p,role_label:p.public_role==='developer'?'Разработчик':(PUBLIC_STATUS_LABELS[p.public_role]||null),bio:p.description,interests:p.hobbies?p.hobbies.split(',').map(x=>x.trim()).filter(Boolean):[]}))});
 }));
app.post('/api/likes/:userId',auth,wrap(async(req,res)=>{
  const id=Number(req.params.userId); if(!Number.isSafeInteger(id)||id===req.user.id)return res.status(400).json({error:'Invalid user'});
  const viewerBand=await getUserAgeBand(req.user.id), targetBand=await getUserAgeBand(id);
  if(!['teen','adult'].includes(viewerBand)||targetBand!==viewerBand)return res.status(403).json({error:'Симпатии доступны только пользователям твоей возрастной стороны VIBE.'});
  const q=await pool.query(`SELECT id FROM users WHERE id=$1 AND account_status='active'`,[id]);
  if(!q.rowCount)return res.status(404).json({error:'User unavailable'});
  await pool.query('INSERT INTO likes(from_user,to_user) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,id]);
  const m=await pool.query('SELECT 1 FROM likes WHERE from_user=$1 AND to_user=$2',[id,req.user.id]); res.json({liked:true,matched:!!m.rowCount});
}));
app.get('/api/likes',auth,wrap(async(req,res)=>{
  const viewerBand=await getUserAgeBand(req.user.id);
  if(!['teen','adult'].includes(viewerBand))return res.json({incoming:[],outgoing:[]});
  const [incoming,outgoing]=await Promise.all([
    pool.query(`SELECT u.id AS id,lst.id AS listing_id,lst.name,lst.age,lst.city,lst.country,lst.hobbies,lst.description,u.photo_url,
      CASE WHEN u.telegram_id::text=$2 THEN 'developer' ELSE COALESCE(NULLIF(u.public_status,''),'none') END AS public_role
      FROM likes l JOIN users u ON u.id=l.from_user JOIN listings lst ON lst.user_id=u.id
      WHERE l.to_user=$1 AND lst.status='published' AND u.account_status='active'
      AND (($3='teen' AND u.birth_date > CURRENT_DATE-INTERVAL '18 years' AND u.birth_date <= CURRENT_DATE-INTERVAL '14 years') OR ($3='adult' AND u.age_verification_status='verified' AND u.verified_birth_date<=CURRENT_DATE-INTERVAL '18 years'))
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
      ORDER BY l.created_at DESC LIMIT 50`,[req.user.id,DEVELOPER_TELEGRAM_ID,viewerBand]),
    pool.query(`SELECT u.id AS id,lst.id AS listing_id,lst.name,lst.age,lst.city,lst.country,lst.hobbies,lst.description,u.photo_url,
      CASE WHEN u.telegram_id::text=$2 THEN 'developer' ELSE COALESCE(NULLIF(u.public_status,''),'none') END AS public_role
      FROM likes l JOIN users u ON u.id=l.to_user JOIN listings lst ON lst.user_id=u.id
      WHERE l.from_user=$1 AND lst.status='published' AND u.account_status='active'
      AND u.age_verification_status='verified' AND u.verified_birth_date<=CURRENT_DATE-INTERVAL '18 years'
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
      ORDER BY l.created_at DESC LIMIT 50`,[req.user.id,DEVELOPER_TELEGRAM_ID,viewerBand])
  ]);
  const normalize = rows => rows.map(p=>({...p,role_label:p.public_role==='developer'?'Разработчик':(PUBLIC_STATUS_LABELS[p.public_role]||null),interests:p.hobbies?p.hobbies.split(',').map(x=>x.trim()).filter(Boolean):[]}));
  res.json({incoming:normalize(incoming.rows),outgoing:normalize(outgoing.rows)});
}));
app.get('/api/chats',auth,wrap(async(req,res)=>{
  const q=await pool.query(`SELECT u.id AS user_id,u.first_name,u.photo_url,
    (SELECT m.body FROM messages m WHERE m.match_low=LEAST($1,u.id) AND m.match_high=GREATEST($1,u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message,
    (SELECT m.created_at FROM messages m WHERE m.match_low=LEAST($1,u.id) AND m.match_high=GREATEST($1,u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
    FROM users u
    WHERE u.id<>$1 AND u.account_status='active'
      AND (EXISTS (SELECT 1 FROM likes a JOIN likes b ON b.from_user=a.to_user AND b.to_user=a.from_user WHERE a.from_user=$1 AND a.to_user=u.id)
        OR EXISTS (SELECT 1 FROM messages m WHERE m.match_low=LEAST($1,u.id) AND m.match_high=GREATEST($1,u.id)))
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
    ORDER BY last_message_at DESC NULLS LAST,u.first_name ASC`,[req.user.id]);
  res.json({chats:q.rows});
}));
app.get('/api/chats/:userId/messages',auth,wrap(async(req,res)=>{
  const other=Number(req.params.userId);
  if(!Number.isSafeInteger(other)||other===Number(req.user.id))return res.status(400).json({error:'Invalid user'});
  const target=await pool.query("SELECT id FROM users WHERE id=$1 AND account_status='active'",[other]);
  if(!target.rowCount)return res.status(404).json({error:'Пользователь недоступен'});
  const blocked=await pool.query('SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[req.user.id,other]);
  if(blocked.rowCount)return res.status(403).json({error:'Переписка недоступна'});
  const q=await pool.query(`SELECT id,sender_id,body,created_at FROM messages WHERE match_low=LEAST($1,$2) AND match_high=GREATEST($1,$2) ORDER BY created_at ASC LIMIT 200`,[req.user.id,other]);
  res.json({messages:q.rows});
}));
app.post('/api/chats/:userId/messages',auth,wrap(async(req,res)=>{
  const other=Number(req.params.userId); const body=req.body?.body;
  if(!Number.isSafeInteger(other)||other===Number(req.user.id)||typeof body!=='string'||!body.trim()||body.trim().length>4000)return res.status(400).json({error:'Некорректное сообщение'});
  const target=await pool.query("SELECT id FROM users WHERE id=$1 AND account_status='active'",[other]);
  if(!target.rowCount)return res.status(404).json({error:'Пользователь недоступен'});
  const blocked=await pool.query('SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[req.user.id,other]);
  if(blocked.rowCount)return res.status(403).json({error:'Нельзя отправить сообщение этому пользователю'});
  const q=await pool.query(`INSERT INTO messages(match_low,match_high,sender_id,body) VALUES(LEAST($1,$2),GREATEST($1,$2),$1,$3) RETURNING id,sender_id,body,created_at`,[req.user.id,other,body.trim()]);
  res.status(201).json({message:q.rows[0]});
}));
app.post('/api/blocks/:userId',auth,wrap(async(req,res)=>{
  const id=Number(req.params.userId); if(!Number.isSafeInteger(id)||id===req.user.id)return res.status(400).json({error:'Invalid user'});
  await pool.query('INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,id]);
  await pool.query('DELETE FROM likes WHERE (from_user=$1 AND to_user=$2) OR (from_user=$2 AND to_user=$1)',[req.user.id,id]);res.json({blocked:true});
}));
app.post('/api/reports/:userId',auth,wrap(async(req,res)=>{
  const id=Number(req.params.userId);
  const {reason,details='',reporterUsername,reportedUsername,evidence='',reportType='profile',listingId=null}=req.body||{};
  if(!Number.isSafeInteger(id)||id===Number(req.user.id))return res.status(400).json({error:'Некорректный пользователь для жалобы'});
  if(typeof reason!=='string'||!reason.trim()||reason.trim().length>100)return res.status(400).json({error:'Укажи обязательную причину жалобы'});
  if(typeof details!=='string'||details.length>1000)return res.status(400).json({error:'Подробности жалобы — не более 1000 символов'});
  if(typeof reporterUsername!=='string'||!/^@?[A-Za-z0-9_]{3,32}$/.test(reporterUsername.trim()))return res.status(400).json({error:'Укажи свой Telegram-юзернейм (3–32 символа)'});
  if(typeof reportedUsername!=='string'||!/^@?[A-Za-z0-9_]{3,32}$/.test(reportedUsername.trim()))return res.status(400).json({error:'Укажи Telegram-юзернейм пользователя, на которого жалуешься'});
  if(!['profile','post'].includes(reportType))return res.status(400).json({error:'Неизвестный тип жалобы'});
  if(typeof evidence!=='string'||evidence.length>3000000||(evidence&&!(evidence.startsWith('data:image/')||evidence.startsWith('data:video/')||evidence.startsWith('data:application/pdf;'))))return res.status(400).json({error:'Доказательство должно быть фото, видео или PDF до 2 МБ'});
  const targetExists=await pool.query("SELECT id,first_name,username FROM users WHERE id=$1 AND account_status='active'",[id]);
  if(!targetExists.rowCount)return res.status(404).json({error:'Профиль не найден или недоступен'});
  const allowedReasons=['Спам','Оскорбления или угрозы','Фейковая анкета','Неприемлемый контент','Подозрение на мошенничество','Преследование или угрозы безопасности','Другое'];
  if(!allowedReasons.includes(reason.trim()))return res.status(400).json({error:'Выбери причину из списка жалоб'});
  const reportedHandle=reportedUsername.trim().replace(/^@/,'');
  const authenticatedHandle=(req.user.username||'').trim();
  if(authenticatedHandle&&reporterUsername.trim().replace(/^@/,'').toLowerCase()!==authenticatedHandle.toLowerCase())return res.status(400).json({error:'Укажи свой настоящий Telegram-юзернейм'});
  if(targetExists.rows[0].username&&reportedHandle.toLowerCase()!==targetExists.rows[0].username.toLowerCase())return res.status(400).json({error:'Юзернейм не совпадает с выбранным профилем'});
  const safeListingId=listingId===null?null:Number(listingId);
  if(safeListingId!==null&&(!Number.isSafeInteger(safeListingId)||safeListingId<1))return res.status(400).json({error:'Некорректная публикация'});
  if(reportType==='post'){
    if(safeListingId===null)return res.status(400).json({error:'Не удалось определить публикацию'});
    const post=await pool.query('SELECT id FROM listings WHERE id=$1 AND user_id=$2',[safeListingId,id]);
    if(!post.rowCount)return res.status(400).json({error:'Публикация не принадлежит выбранному профилю'});
  }
  const inserted=await pool.query('INSERT INTO reports(reporter_id,reported_id,reason,details,reporter_telegram_username,reported_telegram_username,evidence,report_type,listing_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[req.user.id,id,reason.trim(),details.trim(),reporterUsername.trim(),reportedUsername.trim(),evidence,reportType,safeListingId]);
  if(process.env.BOT_TOKEN){
    try{
      const roles=await pool.query("SELECT telegram_id FROM admin_roles WHERE role IN ('chief_admin','admin')");
      const ids=new Set([DEVELOPER_TELEGRAM_ID,...(process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean),...roles.rows.map(x=>String(x.telegram_id))]);
      const target=targetExists.rows[0];
      const reportText=['🚨 Новая жалоба VIBE #'+inserted.rows[0].id,'Тип: '+(reportType==='post'?'на публикацию':'на профиль'),'На пользователя: '+(target.first_name||'неизвестно')+' (@'+reportedHandle+')','От: '+(req.user.first_name||'пользователь')+' ('+reporterUsername.trim()+')','Причина: '+reason.trim(),'Подробности: '+(details.trim()||'—'),'Доказательства: '+(evidence?'приложены файлом в Telegram':'не приложены'),'Открой /очередь в боте для модерации.'].join(String.fromCharCode(10));
      await Promise.all([...ids].map(async telegramId=>{
        try{
          await fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:telegramId,text:reportText})});
          if(evidence){
            const match=evidence.match(/^data:([^;]+);base64,(.+)$/);
            if(match){
              const mime=match[1], bytes=Buffer.from(match[2],'base64');
              const kind=mime.startsWith('video/')?'video':mime==='application/pdf'?'document':mime.startsWith('image/')?'photo':null;
              if(kind){
                const form=new FormData();form.append('chat_id',String(telegramId));
                form.append(kind,new Blob([bytes],{type:mime}),'vibe-report-evidence.'+(mime==='application/pdf'?'pdf':mime.startsWith('video/')?'mp4':'jpg'));
                await fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/send'+(kind==='photo'?'Photo':kind==='video'?'Video':'Document'),{method:'POST',body:form});
              }
            }
          }
        }catch(e){console.error('Report admin notification failed:',e.message);}
      }));
    }catch(e){console.error('Report admin notification failed:',e.message);}
  }
  res.status(201).json({reported:true,reportId:inserted.rows[0].id});
}));
app.post('/api/admin/users/:code/ban',auth,adminOnly,wrap(async(req,res)=>{
  const code=String(req.params.code||'');
  const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';
  if(!/^\\d{6}$/.test(code)) return res.status(400).json({error:'Введи ровно 6 цифр кода профиля'});
  if(!reason||reason.length>500) return res.status(400).json({error:'Укажи причину бана (до 500 символов)'});
  const target=await pool.query("SELECT id,first_name,username,telegram_id FROM users WHERE lpad(id::text,6,'0')=$1",[code]);
  if(!target.rowCount) return res.status(404).json({error:'Профиль с таким кодом не найден'});
  const targetUser=target.rows[0];
  if(String(targetUser.telegram_id)===DEVELOPER_TELEGRAM_ID) {
    await notifyDeveloperAttempt({actorId:req.user.telegram_id,actorName:req.user.first_name,actorUsername:req.user.username,action:'Бан разработчика',source:'Веб-панель модерации'});
    return res.status(403).json({error:'Разработчика нельзя забанить'});
  }
  const actorRole=await getRole(req.user.telegram_id);
  const targetRole=await getRole(targetUser.telegram_id);
  if(roleRank[targetRole]>=roleRank[actorRole]) return res.status(403).json({error:'Нельзя банить пользователя с равным или более высоким рангом'});
  const q=await pool.query("UPDATE users SET account_status='banned',discoverable=FALSE,moderation_note=$1,ban_issuer=$2,updated_at=NOW() WHERE id=$3 RETURNING id,first_name,username,telegram_id",[reason,actorRole==='developer'?'developer':'moderator',targetUser.id]);
  res.json({banned:true,user:{...q.rows[0],profile_code:String(q.rows[0].id).padStart(6,'0')},reason});
}));
app.get('/api/admin/users/:code',auth,adminOnly,wrap(async(req,res)=>{
  const code=String(req.params.code||'');
  if(!/^\\d{6}$/.test(code)) return res.status(400).json({error:'Введи ровно 6 цифр кода профиля'});
  const q=await pool.query("SELECT id,first_name,username,account_status,moderation_note FROM users WHERE lpad(id::text,6,'0')=$1",[code]);
  if(!q.rowCount) return res.status(404).json({error:'Профиль с таким кодом не найден'});
  res.json({user:{...q.rows[0],profile_code:String(q.rows[0].id).padStart(6,'0')}});
}));
app.get('/api/admin/bans',auth,adminOnly,wrap(async(_req,res)=>{
  const q=await pool.query("SELECT id,telegram_id,username,first_name,moderation_note,updated_at FROM users WHERE account_status='banned' ORDER BY updated_at DESC LIMIT 500");
  res.json({bans:q.rows});
}));
app.get('/api/admin/queue',auth,adminOnly,wrap(async(_req,res)=>{
  const [reports,flags]=await Promise.all([
    pool.query(`SELECT r.id,r.reporter_id, a.first_name reporter_name,a.username reporter_username,a.telegram_id reporter_telegram_id,a.account_status reporter_account_status,a.profile_review_status reporter_profile_status,a.bio reporter_bio,a.city reporter_city,a.photo_url reporter_photo_url,a.created_at reporter_created_at,r.reported_id,t.first_name reported_name,r.reason,r.details,r.reporter_telegram_username,r.reported_telegram_username,r.evidence,r.report_type,r.listing_id,r.status,r.created_at,t.username reported_username,t.telegram_id reported_telegram_id,t.account_status,t.profile_review_status,t.photo_url,t.bio FROM reports r JOIN users a ON a.id=r.reporter_id JOIN users t ON t.id=r.reported_id WHERE r.status IN ('open','reviewing') ORDER BY r.created_at ASC LIMIT 200`),
    pool.query(`SELECT f.id,f.user_id,u.first_name,u.username,u.photo_url,u.bio,f.category,f.reason,f.evidence,f.status,f.created_at,u.account_status,u.profile_review_status FROM moderation_flags f JOIN users u ON u.id=f.user_id WHERE f.status IN ('open','reviewing') ORDER BY f.created_at ASC LIMIT 200`)
  ]);res.json({reports:reports.rows,flags:flags.rows});
}));
app.patch('/api/admin/reports/:id',auth,adminOnly,wrap(async(req,res)=>{
  const id=Number(req.params.id);const {status,action='none',note=''}=req.body||{};
  if(!Number.isSafeInteger(id)||!['reviewing','resolved','dismissed'].includes(status)||!['none','restrict','suspend','ban','restore'].includes(action))return res.status(400).json({error:'Invalid action'});
  if(action==='ban'&&(!String(note).trim()||String(note).trim().length>500))return res.status(400).json({error:'Укажи причину бана (до 500 символов)'});
  const c=await pool.connect();try{await c.query('BEGIN');const f=await c.query('SELECT r.reported_id,u.telegram_id FROM reports r JOIN users u ON u.id=r.reported_id WHERE r.id=$1 FOR UPDATE OF r,u',[id]);if(!f.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Report not found'});}if(['ban','restrict','suspend'].includes(action)&&String(f.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){await c.query('ROLLBACK');await notifyDeveloperAttempt({actorId:req.user.telegram_id,actorName:req.user.first_name,actorUsername:req.user.username,action:'Модерация разработчика ('+action+')',source:'Веб-жалобы'});return res.status(403).json({error:'Разработчика нельзя забанить или ограничить'});}
  await c.query('UPDATE reports SET status=$1 WHERE id=$2',[status,id]);if(action!=='none'){const s={restrict:'restricted',suspend:'suspended',ban:'banned',restore:'active'}[action];await c.query(`UPDATE users SET account_status=$1,moderation_note=$2,discoverable=CASE WHEN $1='active' THEN discoverable ELSE FALSE END,ban_issuer=CASE WHEN $1='banned' THEN $4 ELSE ban_issuer END,updated_at=NOW() WHERE id=$3`,[s,note||'Admin action: '+action,f.rows[0].reported_id,req.adminRole==='developer'?'developer':'moderator']);}await c.query('COMMIT');res.json({updated:true});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
app.patch('/api/admin/flags/:id',auth,adminOnly,wrap(async(req,res)=>{
  const id=Number(req.params.id);const {status,action='none',note=''}=req.body||{};
  if(!Number.isSafeInteger(id)||!['reviewing','resolved','dismissed'].includes(status)||!['none','restrict','suspend','ban','restore'].includes(action))return res.status(400).json({error:'Invalid action'});
  if(action==='ban'&&(!String(note).trim()||String(note).trim().length>500))return res.status(400).json({error:'Укажи причину бана (до 500 символов)'});
  const f=await pool.query('SELECT mf.user_id,u.telegram_id FROM moderation_flags mf JOIN users u ON u.id=mf.user_id WHERE mf.id=$1',[id]);if(!f.rowCount)return res.status(404).json({error:'Flag not found'});if(action==='ban'&&String(f.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){await notifyDeveloperAttempt({actorId:req.user.telegram_id,actorName:req.user.first_name,actorUsername:req.user.username,action:'Бан разработчика',source:'Веб-флаги модерации'});return res.status(403).json({error:'Разработчика нельзя забанить'});}await pool.query('UPDATE moderation_flags SET status=$1 WHERE id=$2',[status,id]);
  if(action!=='none'){const s={restrict:'restricted',suspend:'suspended',ban:'banned',restore:'active'}[action];await pool.query('UPDATE users SET account_status=$1,moderation_note=$2,discoverable=CASE WHEN $1=\'active\' THEN discoverable ELSE FALSE END,ban_issuer=CASE WHEN $1=\'banned\' THEN $4 ELSE ban_issuer END,updated_at=NOW() WHERE id=$3',[s,note||'Admin action: '+action,f.rows[0].user_id,req.adminRole==='developer'?'developer':'moderator']);}res.json({updated:true});
}));

app.post('/telegram/webhook', (req,res) => {
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(secret&&req.get('X-Telegram-Bot-Api-Secret-Token')!==secret)return res.sendStatus(401);
  res.sendStatus(200);
  const m=req.body?.message, cb=req.body?.callback_query, token=process.env.BOT_TOKEN;
  if(!token||(!m?.chat?.id&&!cb?.message?.chat?.id))return;
  (async()=>{
    const from=m?.from||cb?.from, chatId=m?.chat?.id||cb?.message?.chat?.id, txt=(m?.text||'').trim();
    const parts=txt.split(/\s+/), cmd=(parts[0]||'').split('@')[0].toLowerCase(), arg=(parts[1]||'').replace(/^@/,'');
    const role = from?.id ? await getRole(from.id) : 'none';
    const ok = roleRank[role] >= roleRank.admin;
    const isDeveloper = role === 'developer';
    if (m && ['/start','/help','/помощь','/admin','/адм'].includes(cmd)) {
      try { await refreshTelegramCommands(chatId, role, token); }
      catch (e) { console.error('Telegram chat command menu refresh failed:', e.message); }
    }
    const send=async(text,markup)=>fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,...(markup?{reply_markup:markup}:{})})});
    const edit=async(text,markup)=>fetch('https://api.telegram.org/bot'+token+'/editMessageText',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,message_id:cb.message.message_id,text,...(markup?{reply_markup:markup}:{})})});
    const answer=async(text='')=>fetch('https://api.telegram.org/bot'+token+'/answerCallbackQuery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({callback_query_id:cb.id,text})});
    const ownAccount=from?.id ? await pool.query('SELECT account_status,moderation_note,ban_issuer FROM users WHERE telegram_id=$1 LIMIT 1',[String(from.id)]) : {rowCount:0,rows:[]};
    if(ownAccount.rowCount && ownAccount.rows[0].account_status==='banned' && String(from.id)!==DEVELOPER_TELEGRAM_ID){
      const issuer=(ownAccount.rows[0].ban_issuer||'moderator')==='developer'?'разработчиком':'модератором';
      const bannedText='⛔ Ваш аккаунт забанен.\nКем заблокирован: '+issuer+'.\nПричина: '+(ownAccount.rows[0].moderation_note||'Причина не указана')+'\nДоступ к VIBE заблокирован.';
      if(cb){await answer('Ваш аккаунт забанен');}
      if(m || cb) await send(bannedText);
      return;
    }
    if(m && (cmd==='/бан' || cmd==='/ban') && /^все$/i.test(arg)){
      if(!isDeveloper){await send('⛔ Недостаточно прав. Команда /бан все доступна только разработчику.');return;}
      const reason=txt.split(/\s+/).slice(2).join(' ').trim();
      if(!reason || reason.length>500){await send('Укажите причину массовой блокировки (до 500 символов).\nФормат: /бан все причина');return;}
      const q=await pool.query("UPDATE users SET account_status='banned',discoverable=FALSE,moderation_note=$1,ban_issuer='developer',updated_at=NOW() WHERE telegram_id<>$2 AND account_status IS DISTINCT FROM 'banned' RETURNING id",[reason,DEVELOPER_TELEGRAM_ID]);
      await send('⛔ Массовая блокировка завершена.\nЗаблокировано аккаунтов: '+q.rowCount+'\nПричина: '+reason);
      return;
    }
    if(m && (cmd==='/разбан' || cmd==='/unban') && /^все$/i.test(arg)){
      if(!isDeveloper){await send('⛔ Недостаточно прав. Команда /разбан все доступна только разработчику.');return;}
      const q=await pool.query("UPDATE users SET account_status='active',discoverable=TRUE,moderation_note=NULL,updated_at=NOW() WHERE telegram_id<>$1 AND account_status='banned' RETURNING id",[DEVELOPER_TELEGRAM_ID]);
      await send('✅ Массовое снятие блокировок завершено.\nВосстановлено аккаунтов: '+q.rowCount);
      return;
    }
    const card=async(id,editMode=false)=>{
      const q=await pool.query('SELECT id,telegram_id,username,first_name,account_status,profile_review_status,moderation_note,bio,city,photo_url,goal,interests,created_at,public_status FROM users WHERE id=$1',[id]);
      if(!q.rowCount){if(editMode)await edit('Пользователь не найден. Возможно, аккаунт был удалён.');else await send('Пользователь не найден.');return;}
      const u=q.rows[0];
      const roleRow = await pool.query('SELECT role FROM admin_roles WHERE telegram_id=$1', [String(u.telegram_id)]);
      const userRole = String(u.telegram_id)===DEVELOPER_TELEGRAM_ID ? 'developer' : (roleRow.rows[0]?.role || 'none');
      const publicStatus = String(u.telegram_id)===DEVELOPER_TELEGRAM_ID ? 'developer' : (u.public_status || 'none');
      const kb={inline_keyboard:[[{text:'🔎 Проверить',callback_data:'u:check:'+id}],[{text:u.account_status==='banned'?'✅ Разбанить':'⛔ Забанить Telegram',callback_data:'u:'+(u.account_status==='banned'?'unban':'ban')+':'+id}],[{text:'🧹 Удалить анкету',callback_data:'u:profile:'+id}],[{text:'🗑 Удалить аккаунт',callback_data:'u:account:'+id}]]};
      if (String(u.telegram_id)!==DEVELOPER_TELEGRAM_ID && isDeveloper) {
        kb.inline_keyboard.push([{text:'👑 Права: главный админ',callback_data:'role:chief_admin:'+id},{text:'🛡 Права: админ',callback_data:'role:admin:'+id}],[{text:'🔨 Права: модератор',callback_data:'role:moderator:'+id},{text:'🧰 Права: помощник',callback_data:'role:helper:'+id}],[{text:'❌ Снять админ-права',callback_data:'role:none:'+id}]);
        kb.inline_keyboard.push([{text:'🏷 Статус: помощник',callback_data:'pubstatus:helper:'+id},{text:'🏷 Статус: модератор',callback_data:'pubstatus:moderator:'+id}],[{text:'🏷 Статус: администратор',callback_data:'pubstatus:admin:'+id},{text:'🏷 Статус: главный админ',callback_data:'pubstatus:chief_admin:'+id}],[{text:'🚫 Убрать публичный статус',callback_data:'pubstatus:none:'+id}]);
      }
      const profileCode=String(u.id).padStart(6,'0');
       const details='VIBE | КАРТОЧКА ПОЛЬЗОВАТЕЛЯ\n━━━━━━━━━━━━━━━━\nИмя: '+u.first_name+'\nКод профиля: '+profileCode+'\nUsername: '+(u.username?'@'+u.username:'не указан')+'\nTelegram ID: '+u.telegram_id+'\nID записи: '+u.id+'\n\nПРАВА И СТАТУСЫ\nАдминистративные права: '+(ROLE_LABELS[userRole]||'Пользователь')+'\nПубличный статус профиля: '+(publicStatus==='developer'?'Разработчик':(PUBLIC_STATUS_LABELS[publicStatus]||'не назначен'))+'\n\nСОСТОЯНИЕ АККАУНТА\nСтатус аккаунта: '+u.account_status+'\nСтатус анкеты: '+u.profile_review_status+'\nПричина ограничения: '+(u.moderation_note||'не указана')+'\n\nДАННЫЕ ПРОФИЛЯ\nГород: '+(u.city||'не указан')+'\nЦель: '+(u.goal||'не указана')+'\nИнтересы: '+((u.interests||[]).join(', ')||'не указаны')+'\nФото профиля: '+(u.photo_url?'добавлено':'не добавлено')+'\nОписание: '+(u.bio||'не указано')+'\nДата регистрации: '+new Date(u.created_at).toLocaleString('ru-RU');
      if(editMode)await edit(details,kb);else await send(details+'\nВыбери действие:',kb);
    };
    if(cb){
      const [prefix,act,idRaw]=(cb.data||'').split(':'), id=Number(idRaw);
      if(prefix==='l') {
        if(!ok){await answer('Доступ разрешён только администраторам.');return;}
        if(!Number.isSafeInteger(id)||id<=0||!['approve','reject'].includes(act)){await answer('Некорректное действие');return;}
        const found=await pool.query('SELECT l.id,l.user_id,l.name,u.telegram_id FROM listings l JOIN users u ON u.id=l.user_id WHERE l.id=$1',[id]);
        if(!found.rowCount){await answer('Анкета не найдена');await edit('Анкета уже удалена или не найдена.');return;}
        const status=act==='approve'?'published':'rejected';
        await pool.query('UPDATE listings SET status=$1,updated_at=NOW() WHERE id=$2',[status,id]);
        const message=act==='approve'?'✅ Твоя анкета VIBE «'+found.rows[0].name+'» прошла проверку и теперь доступна в рекомендациях.':'⚠️ Анкета VIBE «'+found.rows[0].name+'» не прошла проверку. Пожалуйста, исправьте данные и отправьте анкету повторно.';
        await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:found.rows[0].telegram_id,text:message})}).catch(e=>console.error('Listing decision notification failed:',e.message));
        await answer(act==='approve'?'Анкета одобрена и опубликована.':'Анкета отклонена.');
        await edit((act==='approve'?'✅ ОДОБРЕНО':'❌ ОТКЛОНЕНО')+' — анкета #'+id+' («'+found.rows[0].name+'»)'+ '\nРешение: '+new Date().toLocaleString('ru-RU'));
        return;
      }
      if(prefix==='pubstatus') {
        if(!isDeveloper){await answer('Публичные статусы выдаёт только Разработчик');return;}
        if(!Number.isSafeInteger(id)||id<=0||!['none','helper','moderator','admin','chief_admin'].includes(act)){await answer('Недопустимое значение публичного статуса.');return;}
        const target=await pool.query('SELECT telegram_id FROM users WHERE id=$1',[id]);
        if(!target.rowCount){await answer('Учётная запись не найдена.');return;}
        if(String(target.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:'Изменение публичного статуса разработчика',source:'Telegram-кнопка статуса'});await answer('Статус Разработчика закреплён');return;}
        await pool.query('UPDATE users SET public_status=$1,updated_at=NOW() WHERE id=$2',[act==='none'?'':act,id]);
        await answer(act==='none'?'Публичный статус снят':'Выдан публичный статус: '+PUBLIC_STATUS_LABELS[act]);
        await card(id,true);return;
      }
      if(prefix==='role') {
        if(!isDeveloper){await answer('Админ-права может назначать и снимать только Разработчик');return;}
        if(!Number.isSafeInteger(id)||id<=0||!['chief_admin','admin','moderator','helper','none'].includes(act)){await answer('Недопустимое значение административной роли.');return;}
        const target=await pool.query('SELECT telegram_id,username FROM users WHERE id=$1',[id]);
        if(!target.rowCount){await answer('Учётная запись не найдена.');return;}
        const targetId=String(target.rows[0].telegram_id);
        if(targetId===DEVELOPER_TELEGRAM_ID){await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:'Изменение роли разработчика',source:'Telegram-кнопка ролей'});await answer('Нельзя изменить роль Разработчика');return;}
        if(act==='none') await pool.query('DELETE FROM admin_roles WHERE telegram_id=$1',[targetId]);
        else await pool.query(`INSERT INTO admin_roles(telegram_id,username,role,assigned_by) VALUES($1,$2,$3,$4) ON CONFLICT(telegram_id) DO UPDATE SET username=EXCLUDED.username,role=EXCLUDED.role,assigned_by=EXCLUDED.assigned_by,updated_at=NOW()`,[targetId,target.rows[0].username,act,String(from.id)]);
        await answer(act==='none'?'Админ-права сняты':'Назначены админ-права: '+(ROLE_LABELS[act]||act));
        await card(id,true);
        return;
      }
      if(prefix==='br'){
        if(!ok){await answer('Доступ разрешён только администраторам.');return;}
        const targetId=Number(act), reasonKey=idRaw, selected=BAN_REASONS[reasonKey];
        if(!Number.isSafeInteger(targetId)||targetId<=0||!selected){await answer('Причина блокировки недействительна');return;}
        const target=await pool.query('SELECT id,telegram_id,first_name,username FROM users WHERE id=$1',[targetId]);
        if(!target.rowCount){await answer('Пользователь не найден');await edit('Пользователь уже удалён или не найден.');return;}
        if(String(target.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){await answer('Аккаунт разработчика защищён');return;}
        const actorRole=await getRole(String(from.id));
        const targetRole=await getRole(String(target.rows[0].telegram_id));
        if((roleRank[targetRole]??0)>=(roleRank[actorRole]??0)){await answer('Нельзя банить пользователя с равным или более высоким рангом');return;}
        await pool.query("UPDATE users SET account_status='banned',discoverable=FALSE,moderation_note=$1,ban_issuer=$2,updated_at=NOW() WHERE id=$3",[selected.reason,actorRole==='developer'?'developer':'moderator',targetId]);
        await answer('Аккаунт заблокирован: '+selected.label);
        await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:target.rows[0].telegram_id,text:'⛔ Ваш аккаунт забанен.\nКем заблокирован: '+(actorRole==='developer'?'разработчиком':'модератором')+'.\nПричина: '+selected.reason+'\nДоступ к VIBE заблокирован.'})}).catch(e=>console.error('Ban notice failed:',e.message));
        await edit('⛔ АККАУНТ ЗАБЛОКИРОВАН\nПользователь: '+target.rows[0].first_name+' (код '+String(targetId).padStart(6,'0')+')\nКем: '+(actorRole==='developer'?'разработчиком':'модератором')+'\nПричина: '+selected.reason);
        return;
      }
      if(!ok){await answer('Доступ разрешён только администраторам.');return;}
      if(prefix!=='u'||!Number.isSafeInteger(id)||id<=0||!['check','ban','unban','profile','account'].includes(act)){await answer('Некорректное действие');return;}
      const q=await pool.query('SELECT first_name,username,telegram_id FROM users WHERE id=$1',[id]);
      if(!q.rowCount){await answer('Пользователь не найден');await edit('Пользователь не найден или удалён.');return;}
      if(act==='check'){await answer();await card(id,true);return;}
      if(String(q.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID&&['ban','unban','profile','account'].includes(act)){
        const actionLabel={ban:'Бан разработчика',unban:'Изменение статуса разработчика',profile:'Удаление анкеты разработчика',account:'Удаление аккаунта разработчика'}[act];
        await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:actionLabel,source:'Telegram-кнопка модерации'});
        await answer('Действие запрещено: аккаунт разработчика защищён системой безопасности VIBE.');
        await send('⛔ Разработчика нельзя банить, ограничивать или удалять.');
        return;
      }
      if(act==='ban'){const reasonsKeyboard={inline_keyboard:Object.entries(BAN_REASONS).map(([key,item])=>[{text:item.label,callback_data:'br:'+id+':'+key}])};await answer('Выбери причину бана');await send('⛔ Выберите причину блокировки для '+q.rows[0].first_name+'. После нажатия аккаунт будет заблокирован, а выбранная причина сохранится в системе.',reasonsKeyboard);return;}
      if(act==='unban'){await pool.query("UPDATE users SET account_status='active',discoverable=TRUE,moderation_note=NULL,updated_at=NOW() WHERE id=$1",[id]);await answer('Блокировка снята.');await edit('✅ Бан снят.');return;}
      if(act==='profile'){await pool.query("UPDATE users SET bio='',city=NULL,photo_url=NULL,gender=NULL,goal='friendship',interests='{}',discoverable=FALSE,profile_review_status='restricted',moderation_note='Profile deleted by Telegram admin',updated_at=NOW() WHERE id=$1",[id]);await answer('Анкета удалена');await edit('🧹 Анкета удалена. Аккаунт сохранён.');return;}
      if(act==='account'){await pool.query('DELETE FROM users WHERE id=$1',[id]);await answer('Учётная запись удалена.');await edit('🗑 Аккаунт удалён вместе с анкетой, лайками, чатами и жалобами. Пользователь сможет зарегистрироваться снова с тем же Telegram-аккаунтом.');return;}
    }
    if(!m)return;
    let reply,markup;
    if(cmd==='/паливные'||cmd==='/паливный'||cmd==='/безпаливные'||cmd==='/безпаливный'||cmd==='/publicstatus'||cmd==='/clearstatus'){
      if(!isDeveloper){await send('⛔ Публичные статусы может выдавать и снимать только Разработчик.');return;}
      const parts=txt.split(/\s+/);
      const key=(parts[1]||'').replace(/^@/,'');
      if(!key){await send((cmd.startsWith('/без')||cmd==='/clearstatus')?'Формат: /безпаливные @username или /clearstatus @username':'Формат: /паливные @username помощник|модератор|администратор|главный_администратор\nИли: /publicstatus @username helper|moderator|admin|chief_admin');return;}
      const target=await pool.query("SELECT id,telegram_id,username,first_name FROM users WHERE lower(username)=lower($1) OR (lpad(id::text,6,'0')=$1 AND $1 ~ '^[0-9]{6}$')",[key]);
      if(!target.rowCount){await send('Пользователь не найден. Проверьте @username или шестизначный код профиля.');return;}
      const u=target.rows[0];
      if(String(u.telegram_id)===DEVELOPER_TELEGRAM_ID){await send('Публичный статус разработчика защищён и не может быть изменён.');return;}
      if(cmd.startsWith('/без')||cmd==='/clearstatus'){
        await pool.query("UPDATE users SET public_status='',updated_at=NOW() WHERE id=$1",[u.id]);
        await send('✅ Публичный статус снят.\nПользователь: '+u.first_name+' (код '+String(u.id).padStart(6,'0')+'). Права аккаунта не изменены.');
        return;
      }
      const statusKey=(parts[2]||'').toLowerCase().replace(/ё/g,'е');
      const statusMap={'помощник':'helper','helper':'helper','модератор':'moderator','moderator':'moderator','администратор':'admin','админ':'admin','admin':'admin','главный_администратор':'chief_admin','главный-администратор':'chief_admin','chief_admin':'chief_admin'};
      const publicStatus=statusMap[statusKey];
      if(!publicStatus){await send('Укажите статус: помощник, модератор, администратор или главный_администратор.\nПример: /паливные @username помощник');return;}
      await pool.query('UPDATE users SET public_status=$1,updated_at=NOW() WHERE id=$2',[publicStatus,u.id]);
      await send('✅ Публичный статус назначен.\nПользователь: '+u.first_name+' — '+PUBLIC_STATUS_LABELS[publicStatus]+'. Права аккаунта не изменены.');
      return;
    }else if(cmd==='/статус'||cmd==='/status'){
      const maintenance=String(process.env.MAINTENANCE_MODE||'').toLowerCase()==='true';
      reply=maintenance?'VIBE | SERVICE STATUS\nStatus: maintenance\n'+(process.env.MAINTENANCE_MESSAGE||'Maintenance is in progress. Please try again later.'):'VIBE | SERVICE STATUS\nStatus: operational\nThe app is available.';
    }else if(cmd==='/start'){
      let firstVisit = false;
      let firstName = (from?.first_name || '').trim();
      if(from?.id&&from?.first_name) {
        const existing = await pool.query('SELECT 1 FROM users WHERE telegram_id=$1 LIMIT 1',[String(from.id)]);
        firstVisit = existing.rowCount === 0;
        const u=await pool.query('INSERT INTO users(telegram_id,username,first_name) VALUES($1,$2,$3) ON CONFLICT(telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,updated_at=NOW() RETURNING account_status,moderation_note',[String(from.id),from.username??null,from.first_name]);
        if (u.rows[0]?.account_status === 'banned') {
          reply='⛔ Ваша учётная запись VIBE заблокирована.\nПричина: '+(u.rows[0].moderation_note||'Причина не указана')+'\nДоступ к сайту и функциям аккаунта закрыт.';
          await send(reply); return;
        }
        if (['suspended','restricted'].includes(u.rows[0]?.account_status)) {
          reply='⚠️ Доступ к вашей учётной записи VIBE ограничен.\nПричина: '+(u.rows[0].moderation_note||'Причина не указана');
          await send(reply); return;
        }
      }
      if (firstVisit) {
        reply='✨ Привет'+(firstName ? ', '+firstName : '')+'! Добро пожаловать в VIBE 💜\n\nРады, что ты с нами! Здесь можно знакомиться, находить людей со схожими интересами и начинать общение без лишнего напряжения.\n\n🌟 С чего начать:\n1. Открой VIBE кнопкой ниже.\n2. Создай свою анкету и добавь немного о себе.\n3. Укажи интересы и цель знакомства — так другим будет проще найти с тобой общий вайб.\n\n💡 Маленький совет: будь собой — именно так начинаются самые интересные знакомства.\n\nГотов(а) начать? Жми «Открыть VIBE» 👇';
      } else {
        reply='С возвращением'+(firstName ? ', '+firstName : '')+'! 💜\n\nПродолжим искать твой вайб? Открывай VIBE кнопкой ниже 👇';
      }
      markup={inline_keyboard:[[{text:'💜 Открыть VIBE',web_app:{url:'https://vibe-client-sroc.onrender.com'}}]]};
    }else if(cmd==='/адм'||cmd==='/admin'){
      reply=ok?'VIBE | ADMIN PANEL\nYour role: '+(role==='developer'?'Developer':ROLE_LABELS[role])+'\nChoose an action from the keyboard below.':'⛔ This command is available to administrators only.';
      if(ok)markup={keyboard:[[{text:'/queue'},{text:'/users'}],[{text:'/user'},{text:'/help'}]],resize_keyboard:true};
    }else if(cmd==='/бан'||cmd==='/ban'){
      if(!ok)reply='⛔ Доступ разрешён только администраторам.';
      else{const bm=txt.match(/^\/(?:бан|ban)(?:@\S+)?\s+(@?[A-Za-z0-9_]{5,32}|\d{6})$/i);if(!bm)reply='Формат: /ban @username или /ban 001234. Затем выбери причину из списка.';else{const key=bm[1].replace(/^@/,'');const found=await pool.query("SELECT id,first_name,username,telegram_id FROM users WHERE lower(username)=lower($1) OR (lpad(id::text,6,'0')=$1 AND $1 ~ '^[0-9]{6}$')",[key]);if(found.rowCount&&String(found.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:'Бан разработчика (команда /ban)',source:'Telegram-команда'});reply='⛔ Действие запрещено: аккаунт разработчика защищён системой безопасности VIBE.';}else if(!found.rowCount)reply='Пользователь не найден.';else{const targetRole=await getRole(String(found.rows[0].telegram_id));if((roleRank[targetRole]??0)>=(roleRank[role]??0))reply='⛔ Нельзя банить пользователя с равным или более высоким рангом.';else{reply='Выбери причину блокировки для '+found.rows[0].first_name+'.';markup={inline_keyboard:Object.entries(BAN_REASONS).map(([reasonKey,item])=>[{text:item.label,callback_data:'br:'+found.rows[0].id+':'+reasonKey}])};}}}
    }else if(cmd==='/разбан'||cmd==='/unban'){
      if(!ok)reply='⛔ Доступ разрешён только администраторам.';
      else if(!/^(@?[A-Za-z0-9_]{5,32}|\d{6})$/.test(arg))reply='Формат: /разбан @username или /разбан 001234';
      else{
        const targetKey=arg.replace(/^@/,'');
        const found=await pool.query("SELECT id,first_name,username,telegram_id FROM users WHERE lower(username)=lower($1) OR (lpad(id::text,6,'0')=$1 AND $1 ~ '^[0-9]{6}$')",[targetKey]);
        if(!found.rowCount)reply='Пользователь не найден. Проверь username или 6-значный код.';
        else if(String(found.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:'Изменение статуса разработчика командой /разбан',source:'Telegram-команда'});reply='⛔ Статус аккаунта разработчика защищён от изменений.';}
        else{const target=await pool.query("UPDATE users SET account_status='active',discoverable=TRUE,moderation_note=NULL,updated_at=NOW() WHERE id=$1 RETURNING id,first_name,username",[found.rows[0].id]);reply='✅ Разбанен: '+target.rows[0].first_name+' (код '+String(target.rows[0].id).padStart(6,'0')+(target.rows[0].username?', @'+target.rows[0].username:'')+').'}
      }
    }else if(cmd==='/удалить'||cmd==='/delete'){
      if(!ok)reply='⛔ Доступ разрешён только администраторам.';
      else if(!/^(@?[A-Za-z0-9_]{5,32}|\d{6})$/.test(arg))reply='Формат: /удалить @username или /удалить 001234';
      else{const key=arg.replace(/^@/,'');const found=await pool.query("SELECT id,first_name,username,telegram_id FROM users WHERE lower(username)=lower($1) OR (id::text=$1 AND $1 ~ '^[0-9]{6}$')",[key]);if(found.rowCount&&String(found.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:'Удаление аккаунта разработчика (команда /удалить)',source:'Telegram-команда'});reply='⛔ Действие запрещено: аккаунт разработчика защищён системой безопасности VIBE.';}else if(!found.rowCount)reply='Пользователь не найден. Проверь username или 6-значный код.';else{const target=await pool.query('DELETE FROM users WHERE id=$1 RETURNING id,first_name,username',[found.rows[0].id]);reply='🗑 Аккаунт '+target.rows[0].first_name+' (код '+String(target.rows[0].id).padStart(6,'0')+(target.rows[0].username?', @'+target.rows[0].username:'')+') удалён.';}}
    }else if(cmd==='/юзер'||cmd==='/user'){
      if(!ok)reply='⛔ Доступ разрешён только администраторам.';
      else if(!arg)reply='Формат: /юзер @username, /юзер 001234 или /юзер Telegram_ID';
      else{const q=await pool.query(`SELECT id FROM users WHERE telegram_id::text=$1 OR lower(username)=lower($1) OR (id::text=$1 AND $1 ~ '^[0-9]{6}$')`,[arg]);if(!q.rowCount)reply='Пользователь не найден. Он должен хотя бы один раз открыть бота или приложение VIBE.';else{await card(q.rows[0].id);return;}}
    }else if(cmd==='/помощь'||cmd==='/help'){
      reply=ok?'VIBE | COMMAND HELP\n\n/admin — open the admin panel\n/queue — moderation queue summary\n/users — total registered accounts\n/bans — list banned accounts\n/user @username or 001234 — view a user card\n/ban 001234 — choose a ban reason from the list\n/unban @username or 001234 — unban an account\n/delete @username or 001234 — delete an account\n/status — check service status\n'+(isDeveloper?'\nDEVELOPER COMMANDS\n/publicstatus @username helper|moderator|admin|chief_admin — set a public profile badge\n/clearstatus @username — remove a public profile badge\n\nPublic badges do not grant admin permissions. Administrative roles are managed separately in the user card.':''):'Welcome to VIBE. Send /start to open the app.';
    }else if(cmd==='/очередь'||cmd==='/queue'){
      if(!ok)reply='⛔ Доступ разрешён только администраторам.';
      else{const [r,f]=await Promise.all([pool.query("SELECT COUNT(*)::int count FROM reports WHERE status IN ('open','reviewing')"),pool.query("SELECT COUNT(*)::int count FROM moderation_flags WHERE status IN ('open','reviewing')")]);reply='VIBE | СВОДКА МОДЕРАЦИИ\nОткрытые жалобы: '+r.rows[0].count+'\nОткрытые сигналы модерации: '+f.rows[0].count;}
    }else if(cmd==='/баны'||cmd==='/bans'){
      if(!ok)reply='⛔ Доступ разрешён только администраторам.';
      else{const q=await pool.query("SELECT id,first_name,username,telegram_id,moderation_note FROM users WHERE account_status='banned' ORDER BY updated_at DESC LIMIT 50");reply=q.rowCount?'VIBE | ЗАБЛОКИРОВАННЫЕ АККАУНТЫ ('+q.rowCount+')\n\n'+q.rows.map(u=>'ID анкеты: '+u.id+' — '+u.first_name+(u.username?' (@'+u.username+')':'')+'\nTelegram ID: '+u.telegram_id+'\nПричина: '+(u.moderation_note||'—')+'\nРазбан: '+(u.username?'/разбан @'+u.username:'нет username — используй кнопку в карточке пользователя')).join('\n\n'):'✅ Аккаунтов с активной блокировкой не найдено.';}
    }else if(cmd==='/пользователи'||cmd==='/users'){
      if(!ok)reply='⛔ Доступ разрешён только администраторам.';else{const q=await pool.query('SELECT COUNT(*)::int count FROM users');reply='VIBE | СТАТИСТИКА\nВсего аккаунтов: '+q.rows[0].count;}
    }else if(EXTRA_ADMIN_COMMANDS.some(item=>cmd==='/'+item.command)){
      if(!ok)reply='⛔ This command is available to administrators only.';
      else reply=await handleExtraAdminCommand({command:cmd.slice(1),parts,pool,role,developerId:DEVELOPER_TELEGRAM_ID,apiUrl:'https://znakomstva-824i.onrender.com',clientUrl:'https://vibe-client-sroc.onrender.com'});
    }else{reply='Send /start to open the VIBE app.';markup={inline_keyboard:[[{text:'Open VIBE',web_app:{url:'https://vibe-client-sroc.onrender.com'}}]]};}
    await send(reply,markup);
  })().catch(e=>console.error('Telegram webhook processing failed:',e.message));
});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Internal server error'});});
async function start() {
  try {
    // Create VIBE tables in the configured VIBE database; CREATE IF NOT EXISTS preserves existing rows.
    const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
    await pool.query(schema);
    await pool.query("ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check");
    await pool.query("ALTER TABLE listings ADD CONSTRAINT listings_status_check CHECK (status IN ('draft','pending','published','hidden','rejected'))");
    await pool.query(`CREATE TABLE IF NOT EXISTS admin_roles (telegram_id TEXT PRIMARY KEY, username TEXT, role TEXT NOT NULL CHECK (role IN ('chief_admin','admin','moderator','helper')), assigned_by TEXT NOT NULL, is_public BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await pool.query('ALTER TABLE admin_roles ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE');
      await pool.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS media_url TEXT');
      await pool.query("ALTER TABLE listings ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'");
      await pool.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_telegram_username TEXT');
      await pool.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_telegram_username TEXT');
      await pool.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS evidence TEXT');
      await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'profile'");
      await pool.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS listing_id BIGINT');
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS public_status TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_issuer TEXT NOT NULL DEFAULT 'moderator'");
    console.log('VIBE database schema ready');
  } catch (err) {
    console.error('VIBE database schema initialization failed:', err.message);
  }
  app.listen(port, () => {
    console.log('VIBE API listening on ' + port);
    const token = process.env.BOT_TOKEN;
    if (token) {
      const publicCommands = telegramCommandsForRole('none');
      const adminCommands = telegramCommandsForRole('admin');
      const developerCommands = telegramCommandsForRole('developer');
      const setCommands = (commands, scope) => Promise.all([
        fetch('https://api.telegram.org/bot' + token + '/setMyCommands', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ commands, scope })
        }).then(r => r.json()),
        fetch('https://api.telegram.org/bot' + token + '/setMyCommands', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ commands, scope, language_code: 'ru' })
        }).then(r => r.json())
      ]).then(results => {
        const failed = results.filter(result => !result.ok);
        if (failed.length) console.error('Telegram command menu setup failed:', failed.map(result => result.description).join('; '));
        else console.log('Telegram command menu configured:', scope.type, 'default and ru');
      }).catch(err => console.error('Telegram command menu setup failed:', err.message));
      // Explicitly override every broad scope so stale BotFather / prior command lists cannot expose admin commands in ordinary chats.
      setCommands(publicCommands, { type: 'default' });
      setCommands(publicCommands, { type: 'all_private_chats' });
      setCommands(publicCommands, { type: 'all_group_chats' });
      setCommands(developerCommands, { type: 'chat', chat_id: Number(DEVELOPER_TELEGRAM_ID) });
      pool.query("SELECT telegram_id FROM admin_roles WHERE role IN ('chief_admin','admin')")
        .then(q => Promise.all([...new Set([...(process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean), ...q.rows.map(x => String(x.telegram_id))])]
          .filter(id => id !== DEVELOPER_TELEGRAM_ID)
          .map(id => setCommands(adminCommands, { type: 'chat', chat_id: Number(id) }))))
        .catch(err => console.error('Telegram admin command menu setup failed:', err.message));
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