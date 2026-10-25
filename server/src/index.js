import 'dotenv/config';
import { initializeDatabase } from './db/initialize.js';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';
import { validateTelegramInitData } from './telegram.js';
import { EXTRA_ADMIN_COMMANDS, handleExtraAdminCommand } from './admin-commands.js';
import { profileTextProblem } from './moderation/text-policy.js';
import { validateReportEvidence } from './moderation/evidence-policy.js';
import { validateListingMedia } from './moderation/media-policy.js';
import { ageOnDate, ageBandForUser } from './age-policy.js';

const app = express();
// Render terminates TLS and forwards the original client IP through one trusted proxy.
app.set('trust proxy', 1);
const port = Number(process.env.PORT || 3001);
const DEVELOPER_TELEGRAM_ID = '8745499515';
// Authenticate Telegram webhook requests even when no stable secret is configured in Render.
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || createHash('sha256').update('vibe-webhook:' + (process.env.BOT_TOKEN || 'missing-bot-token')).digest('hex').slice(0, 64);
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

const TELEGRAM_COMMAND_DESCRIPTIONS = {
  help: 'Help and support',
  adminhelp: 'Show commands available for your role',
  helpadmin: 'Show administrator help',
  myrole: 'Show your active and assigned role',
  switchrole: 'Switch to an assigned role',
  queue: 'Open moderation queue',
  ping: 'Check bot response',
  health: 'Check service health',
  permissions: 'Show role permissions',
  stats: 'Show platform statistics',
  today: 'Show accounts created today',
  week: 'Show accounts created this week',
  pending: 'Count profiles awaiting review',
  published: 'Count published profiles',
  rejected: 'Count rejected profiles',
  reports: 'List open user reports',
  reportstats: 'Show report statistics',
  flags: 'List moderation flags',
  flagstats: 'Show moderation flag statistics',
  recent: 'List recently registered users',
  inactive: 'List inactive accounts',
  search: 'Search users by name or username',
  bycity: 'Count profiles by city',
  topcities: 'Show popular profile cities',
  interests: 'Show popular interests',
  likes: 'Show likes and mutual likes statistics',
  matches: 'Show mutual matches statistics',
  chats: 'Show active chat statistics',
  messages: 'Show message statistics',
  profiles: 'Show profile statistics',
  verified: 'Count age-verified adult accounts',
  unverified: 'Count accounts awaiting age review',
  agequeue: 'Open age-review queue',
  ban: 'Ban a user account',
  unban: 'Restore a banned account',
  delete: 'Delete a user account',
  deleteall: 'Preview or confirm bulk account deletion',
  users: 'Count registered users',
  bans: 'List banned accounts',
  staff: 'List team members and roles',
  admins: 'List administrators',
  moderators: 'List moderators',
  helpers: 'List helpers',
  botinfo: 'Show bot configuration status',
  dbcheck: 'Check database connectivity',
  support: 'Open user support options',
};

function telegramCommandsForRole(role) {
  const core = [
    { command: 'help', description: TELEGRAM_COMMAND_DESCRIPTIONS.help },
    { command: 'adminhelp', description: TELEGRAM_COMMAND_DESCRIPTIONS.adminhelp },
    { command: 'myrole', description: TELEGRAM_COMMAND_DESCRIPTIONS.myrole },
    { command: 'switchrole', description: TELEGRAM_COMMAND_DESCRIPTIONS.switchrole },
    { command: 'queue', description: TELEGRAM_COMMAND_DESCRIPTIONS.queue },
    { command: 'ping', description: TELEGRAM_COMMAND_DESCRIPTIONS.ping },
  ];
  const extra = EXTRA_ADMIN_COMMANDS
    .filter(item => /^[a-z0-9_]{1,32}$/.test(item.command) && roleCanUseCommand(role, item.command))
    .map(item => ({
      command: item.command,
      description: TELEGRAM_COMMAND_DESCRIPTIONS[item.command] || `Run the ${item.command.replace(/_/g, ' ')} command`,
    }));
  const commands = [...core.filter(item => item.command === 'help' || roleCanUseCommand(role, item.command)), ...extra];
  const unique = [...new Map(commands.map(item => [item.command, item])).values()];
  return unique.slice(0, 100);
}

async function hideTelegramCommands(token) {
  if (!token) return;
  const call = async (scope, commands) => {
    const response = await fetch('https://api.telegram.org/bot' + token + '/setMyCommands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commands, scope }),
    });
    const result = await response.json();
    if (!result.ok) console.error('Telegram command menu update failed:', scope.type, result.description);
  };

  await call({ type: 'default' }, [{ command: 'help', description: 'Help and support' }]);
  await call({ type: 'all_group_chats' }, []);

  const staff = await pool.query("SELECT telegram_id FROM admin_roles WHERE role IN ('chief_admin','admin','moderator','helper')");
  const staffIds = new Set([
    DEVELOPER_TELEGRAM_ID,
    ...(process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(value => value.trim()).filter(Boolean),
    ...staff.rows.map(row => String(row.telegram_id)),
  ]);

  for (const id of staffIds) {
    const role = await getRole(id);
    if (role === 'none') continue;
    await call({ type: 'chat', chat_id: Number(id) }, telegramCommandsForRole(role));
  }
}
function hashAdminPassword(password,salt){return scryptSync(password,salt,64).toString('hex');}
function verifyAdminPassword(password,salt,storedHash){try{const a=Buffer.from(hashAdminPassword(password,salt),'hex'),b=Buffer.from(storedHash,'hex');return a.length===b.length&&timingSafeEqual(a,b);}catch{return false;}}
async function isAdminUnlocked(id){const q=await pool.query('SELECT unlocked_until FROM admin_access_sessions WHERE telegram_id=$1',[String(id)]);return q.rowCount>0&&new Date(q.rows[0].unlocked_until)>new Date();}
// Public profile badges are independent from admin_roles permissions.
const roleRank = { none: 0, helper: 1, moderator: 2, admin: 3, chief_admin: 4, developer: 5 };
const ROLE_COMMANDS = {
  helper: new Set(['adminhelp','helpadmin','myrole','роль','switchrole','помощь','help','support','helpuser','queue','review','resolve','dismiss','reports','reportqueue','flags','flagqueue','ping','health','permissions','myrole','reportstats','flagstats']),
  moderator: new Set(['adminhelp','helpadmin','myrole','роль','switchrole','queue','review','resolve','dismiss','reports','reportqueue','flags','flagqueue','ping','health','permissions','reportstats','flagstats','pending','published','rejected','approve','reject','hide','show','profilequeue','queueall','oldreports','closedreports','agequeue','verified','unverified','restrict','suspend','restore','user','юзер','роль','myrole']),
  admin: new Set(['adminhelp','helpadmin','myrole','роль','switchrole','queue','users','пользователи','bans','баны','user','юзер','ban','бан','unban','разбан','delete','удалить','stats','today','week','pending','published','rejected','reports','reportqueue','reportstats','flags','flagqueue','flagstats','recent','inactive','search','bycity','topcities','interests','likes','matches','chats','messages','profiles','staff','admins','moderators','helpers','rolecheck','permissions','statuslist','review','resolve','dismiss','approve','reject','hide','show','restrict','suspend','restore','health','ping','dbcheck','botinfo','queueall','profilequeue','oldreports','closedreports','banned','restricted','suspended','blocked','blocks','likesstats','matchstats','activity','часовойпояс','пароль']),
  chief_admin: new Set(['*']),
  developer: new Set(['*'])
};
function roleCanUseCommand(role, command){
  if(role==='developer'||role==='chief_admin') return true;
  const normalized=String(command||'').replace('/','').split('@')[0].toLowerCase();
  return ROLE_COMMANDS[role]?.has(normalized) || EXTRA_ADMIN_COMMANDS.some(item=>item.command===normalized && (role==='admin' || role==='moderator' && ROLE_COMMANDS.moderator.has(normalized) || role==='helper' && ROLE_COMMANDS.helper.has(normalized)));
}
function adminCommandHelp(role){
  const core=[
    ['/adminhelp','полный список команд'],
    ['/myrole','показать активную и максимальную роли'],
    ['/switchrole helper|moderator|admin|chief_admin|developer|max','переключить активную роль в пределах назначенного ранга'],
    ['/queue','очередь жалоб и сигналов модерации'],
    ['/ping','проверить ответ бота']
  ];
  const adminCore=[
    ['/users','количество пользователей'], ['/bans','список заблокированных аккаунтов'],
    ['/user @username или 001234','карточка пользователя'], ['/ban @username или 001234','заблокировать пользователя'],
    ['/unban @username или 001234','снять блокировку'], ['/delete @username или 001234','удалить аккаунт'],
    ['/часовойпояс Europe/Berlin','установить личный часовой пояс'], ['/пароль ВАШ_ПАРОЛЬ','задать пароль (от 4 символов)']
  ];
  const developerCore=[['/deleteall','предпросмотр массового удаления'],['/deleteall CONFIRM','подтвердить массовое удаление'],['/пароли','список администраторов'],['/resetadminpass TELEGRAM_ID','сбросить пароль администратора']];
  const format=items=>items.map(([command,description])=>'• '+command+' — '+description).join('\n');
  const visibleCore=core.concat(roleRank[role]>=roleRank.admin?adminCore:[]).concat(role==='developer'?developerCore:[]);
  const extras=EXTRA_ADMIN_COMMANDS.filter(item=>roleCanUseCommand(role,item.command)).map(item=>['/'+item.command,item.description]);
  return '🛡 VIBE | КОМАНДЫ РОЛИ: '+({helper:'ПОМОЩНИК',moderator:'МОДЕРАТОР',admin:'АДМИНИСТРАТОР',chief_admin:'ГЛАВНЫЙ АДМИНИСТРАТОР',developer:'РАЗРАБОТЧИК'}[role]||'НЕТ ДОСТУПА')+'\n━━━━━━━━━━━━━━━━━━\n🔑 ОСНОВНЫЕ КОМАНДЫ\n'+format(visibleCore)+'\n\n📚 ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ ('+extras.length+')\n'+format(extras)+'\n\nДоступ зависит от активной роли. Вернуться к максимальной: /switchrole max';
}
function adminReplyKeyboard(role){
  const rows=[[{text:'/adminhelp'},{text:'/myrole'}],[{text:'/queue'},{text:'/reports'}],[{text:'/reportstats'},{text:'/users'}]];
  if(roleRank[role]>=roleRank.admin) rows.push([{text:'/ban'},{text:'/unban'},{text:'/user'}]);
  return {keyboard:rows,resize_keyboard:true,one_time_keyboard:false,is_persistent:true};
}
async function notifyDeveloperAttempt({actorId,actorName,actorUsername,action,source}) {
  if (!process.env.BOT_TOKEN) return;
  const text = 'VIBE | СИСТЕМА БЕЗОПАСНОСТИ\nЗарегистрирована заблокированная попытка действия в отношении разработчика.\nДействие: ' + action + '\nКто пытался: ' + (actorUsername ? '@' + actorUsername : (actorName || 'неизвестно')) + (actorUsername && actorName ? ' (' + actorName + ')' : '') + '\nИсточник: ' + source + '\nРезультат: действие заблокировано системой безопасности VIBE.';
  try {
    const r = await fetch('https://api.telegram.org/bot' + process.env.BOT_TOKEN + '/sendMessage', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({chat_id:DEVELOPER_TELEGRAM_ID,text}) });
    if (!r.ok) console.error('Developer protection notification failed:', await r.text());
  } catch (e) { console.error('Developer protection notification failed:', e.message); }
}
async function getRole(telegramId) {
  const id=String(telegramId);
  let assigned='none';
  if(id===DEVELOPER_TELEGRAM_ID) assigned='developer';
  else {
    const q=await pool.query('SELECT role FROM admin_roles WHERE telegram_id=$1',[id]);
    if(q.rowCount) assigned=q.rows[0].role;
    else if((process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).includes(id)) assigned='admin';
  }
  if(assigned==='none') return 'none';
  const active=await pool.query('SELECT role FROM admin_active_roles WHERE telegram_id=$1',[id]);
  const current=active.rows[0]?.role;
  return current && roleRank[current]!==undefined && roleRank[current]<=roleRank[assigned] ? current : assigned;
}
async function getAssignedRole(telegramId) {
  const id = String(telegramId);
  if (id === DEVELOPER_TELEGRAM_ID) return 'developer';
  const assigned = await pool.query('SELECT role FROM admin_roles WHERE telegram_id=$1', [id]);
  if (assigned.rowCount) return assigned.rows[0].role;
  if ((process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(value => value.trim()).includes(id)) return 'admin';
  return 'none';
}

async function ensureTargetBelowActor(targetTelegramId, actorRole) {
  const targetRole = await getAssignedRole(targetTelegramId);
  if (targetRole === 'developer' || roleRank[targetRole] >= roleRank[actorRole]) return false;
  return true;
}

async function logModerationAction({actorId,actorRole,action,targetUserId=null,listingId=null,reason='',metadata={}}) {
  try {
    await pool.query('INSERT INTO moderation_audit_log(actor_telegram_id,actor_role,action,target_user_id,listing_id,reason,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[String(actorId),String(actorRole),String(action),targetUserId,listingId,String(reason||''),JSON.stringify(metadata||{})]);
  } catch (error) { console.error('Moderation audit write failed:', error.message); }
}

async function canManage(req,res,next) {
  try {
    const role = await getRole(req.user.telegram_id);
    if (roleRank[role] < roleRank.admin) return res.status(403).json({error:'Admin access denied'});
    if (role !== 'developer' && !await isAdminUnlocked(req.user.telegram_id)) {
      return res.status(403).json({error:'Admin session is locked. Unlock access in the VIBE Telegram bot first.'});
    }
    req.adminRole = role;
    next();
  } catch (e) { next(e); }
}
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(origin => origin.trim()).filter(Boolean) }));
app.use(express.json({ limit: '8mb' }));
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

// Protect expensive and abuse-prone endpoints. User-scoped limits run after auth;
// the authentication endpoint is IP-limited because no trusted identity exists yet.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуй позже.' },
});
const userActionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуй позже.' },
});
const reportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много жалоб. Попробуй позже.' },
});
const storyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много историй. Попробуй позже.' },
});

async function auth(req,res,next) {
  try {
    const bearer = String(req.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9_-]{32,})$/);
    if (bearer) {
      const tokenHash = createHash('sha256').update(bearer[1]).digest('hex');
      const session = await pool.query(`SELECT u.id,u.telegram_id,u.email,u.email_verified_at,u.username,u.first_name,u.birth_date,u.verified_birth_date,
        u.age_verification_status,u.age_verified_at,u.gender,u.profile_review_status,u.account_status,u.bio,u.city,u.photo_url,u.goal,u.interests,u.discoverable,
        u.moderation_note,u.public_status,u.ban_issuer
        FROM web_sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at>NOW() LIMIT 1`, [tokenHash]);
      if (!session.rowCount) return res.status(401).json({error:'Сессия истекла. Войди снова.'});
      req.user = session.rows[0];
      pool.query('UPDATE web_sessions SET last_used_at=NOW() WHERE token_hash=$1',[tokenHash]).catch(()=>{});
    } else {
      const identity = validateTelegramInitData(req.get('X-Telegram-Init-Data'), process.env.BOT_TOKEN);
      req.user = await upsertTelegramUser(identity);
    }
    const maintenance=await pool.query("SELECT enabled,reason FROM service_maintenance WHERE id=1");
    if(maintenance.rows[0]?.enabled && String(req.user.telegram_id)!==DEVELOPER_TELEGRAM_ID)
      return res.status(503).json({error:'VIBE временно закрыт',maintenance:true,reason:maintenance.rows[0].reason});
    // Blocked users may still authenticate only to submit an appeal; every other API route stays blocked.
    if (req.path !== '/api/appeals' && req.user.account_status === 'banned') {
      return res.status(403).json({ error: 'Ваш аккаунт забанен', banned: true, reason: req.user.moderation_note || 'Причина не указана', moderation_note: req.user.moderation_note || '', ban_issuer: req.user.ban_issuer || 'moderator', ban_issuer_label: (req.user.ban_issuer || 'moderator') === 'developer' ? 'разработчиком' : 'модератором' });
    }
    if (req.path !== '/api/appeals' && ['suspended','restricted'].includes(req.user.account_status)) {
      return res.status(403).json({ error: 'Доступ к аккаунту ограничен', restricted: true, reason: req.user.moderation_note || 'Причина не указана' });
    }
    next();
  } catch (e) {
    if (e?.message?.includes('Telegram')) return res.status(401).json({error:'Telegram authentication failed'});
    next(e);
  }
}
const adminOnly = canManage;
async function upsertTelegramUser(identity) {
  const result = await pool.query(`INSERT INTO users (telegram_id, username, first_name, photo_url)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (telegram_id) DO UPDATE
      SET username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
          updated_at = NOW()
    RETURNING id, telegram_id, email, email_verified_at, username, first_name, birth_date, verified_birth_date,
      age_verification_status, age_verified_at, gender, profile_review_status,
      account_status, bio, city, photo_url, goal, interests, discoverable,
      moderation_note, public_status, ban_issuer`,
    [identity.id, identity.username, identity.firstName, identity.photoUrl]);
  return result.rows[0];
}
app.get('/api/service-status',wrap(async(_req,res)=>{const q=await pool.query("SELECT enabled,reason FROM service_maintenance WHERE id=1");const m=q.rows[0];res.json({maintenance:Boolean(m?.enabled),reason:m?.reason||''});}));
app.get('/health',wrap(async(_req,res)=>{const q=await pool.query("SELECT enabled,reason FROM service_maintenance WHERE id=1");const m=q.rows[0];const maintenance=Boolean(m?.enabled)||String(process.env.MAINTENANCE_MODE||'').toLowerCase()==='true';res.status(maintenance?503:200).json({ok:!maintenance,status:maintenance?'maintenance':'online',app:'vibe-api',message:maintenance?(m?.reason||process.env.MAINTENANCE_MESSAGE||'Проводятся технические работы. Попробуйте позже.'): 'Сервер работает нормально'});}));

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
async function issueWebSession(userId) {
  const token=randomBytes(32).toString('base64url');
  const tokenHash=createHash('sha256').update(token).digest('hex');
  await pool.query('INSERT INTO web_sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL \'30 days\')',[userId,tokenHash]);
  return token;
}
async function createOrGetEmailUser(email) {
  const localPart=email.split('@')[0].replace(/[^\p{L}\p{N}._-]/gu,'').slice(0,50);
  const firstName=localPart || 'Участник VIBE';
  const q=await pool.query(`INSERT INTO users(email,email_verified_at,first_name)
    VALUES($1,NOW(),$2)
    ON CONFLICT DO UPDATE SET email_verified_at=COALESCE(users.email_verified_at,NOW()),updated_at=NOW()
    RETURNING id,telegram_id,email,email_verified_at,username,first_name,birth_date,verified_birth_date,age_verification_status,age_verified_at,gender,profile_review_status,account_status,bio,city,photo_url,goal,interests,discoverable,moderation_note,public_status,ban_issuer`,[email,firstName]);
  return q.rows[0];
}
// Email authentication is handled by Supabase Auth on the client and verified below.
app.post('/api/auth/supabase',authRateLimit,wrap(async(req,res)=>{
  const accessToken=String(req.body?.access_token||'');
  if(!accessToken||accessToken.length>10000)return res.status(400).json({error:'Не удалось получить подтверждение входа.'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY)return res.status(503).json({error:'Supabase пока не настроен на сервере VIBE.'});
  const verify=await fetch((process.env.SUPABASE_URL.endsWith('/')?process.env.SUPABASE_URL.slice(0,-1):process.env.SUPABASE_URL)+'/auth/v1/user',{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+accessToken}});
  if(!verify.ok)return res.status(401).json({error:'Supabase не подтвердил вход. Попробуй ещё раз.'});
  const identity=await verify.json();
  const email=normalizeEmail(identity.email);
  if(!identity.id||!email||!identity.email_confirmed_at)return res.status(403).json({error:'Сначала подтверди адрес электронной почты.'});
  const user=await createOrGetEmailUser(email);
  if(user.account_status!=='active')return res.status(403).json({error:'Доступ к аккаунту ограничен.',banned:user.account_status==='banned'});
  const token=await issueWebSession(user.id);
  res.json({ok:true,token,user});
}));
app.post('/api/auth/logout',auth,wrap(async(req,res)=>{
  const bearer=String(req.get('Authorization')||'').match(/^Bearer ([A-Za-z0-9_-]{32,})$/);
  if(bearer){const tokenHash=createHash('sha256').update(bearer[1]).digest('hex');await pool.query('DELETE FROM web_sessions WHERE token_hash=$1',[tokenHash]);}
  res.json({ok:true});
}));
app.post('/api/auth/telegram',authRateLimit,wrap(async(req,res)=>{
  const maintenance=await pool.query("SELECT enabled,reason FROM service_maintenance WHERE id=1");
  if(maintenance.rows[0]?.enabled){const i=validateTelegramInitData(req.body?.initData,process.env.BOT_TOKEN);if(String(i.id)!==DEVELOPER_TELEGRAM_ID)return res.status(503).json({error:'VIBE временно закрыт',maintenance:true,reason:maintenance.rows[0].reason});}
  const i=validateTelegramInitData(req.body?.initData,process.env.BOT_TOKEN);
  const u = await upsertTelegramUser(i);
  if (u.account_status === 'banned') return res.status(403).json({ error: 'Ваш аккаунт забанен', banned: true, reason: u.moderation_note || 'Причина не указана', moderation_note: u.moderation_note || '' });
  if (['suspended','restricted'].includes(u.account_status)) return res.status(403).json({ error: 'Доступ к аккаунту ограничен', restricted: true, reason: u.moderation_note || 'Причина не указана' });
  res.json({user:u});
}));
app.get('/api/me',auth,wrap(async(req,res)=>{const [r,likes]=await Promise.all([pool.query('SELECT role FROM admin_roles WHERE telegram_id=$1',[String(req.user.telegram_id)]),pool.query('SELECT COUNT(*)::int AS count FROM likes WHERE to_user=$1',[req.user.id])]);const role=String(req.user.telegram_id)===DEVELOPER_TELEGRAM_ID?'developer':(r.rows[0]?.role||'none');const status=String(req.user.telegram_id)===DEVELOPER_TELEGRAM_ID?'developer':(req.user.public_status||'none');res.json({user:{...req.user,account_code:String(req.user.id).padStart(6,'0'),likes_received:likes.rows[0]?.count||0,admin_access:roleRank[role]>=roleRank.admin,public_role:status,role_label:status==='developer'?'Разработчик':(PUBLIC_STATUS_LABELS[status]||null)}});}));
app.get('/api/referrals',auth,wrap(async(req,res)=>{const q=await pool.query('SELECT COUNT(*)::int AS count FROM referrals WHERE referrer_user_id=$1',[req.user.id]);res.json({count:q.rows[0]?.count||0,account_code:String(req.user.id).padStart(6,'0')});}));
app.put('/api/me',auth,wrap(async(req,res)=>{
  const {birthDate,gender=null,bio='',city=null,photoUrl=null,goal='friendship',interests=[]}=req.body||{};
  if(typeof bio!=='string'||bio.length>500||!['friendship','chat','relationship','both'].includes(goal)||!Array.isArray(interests)||interests.length>20) return res.status(400).json({error:'Invalid profile'});
  if(interests.some(value=>typeof value!=='string'||value.trim().length>50)) return res.status(400).json({error:'Каждый интерес должен быть текстом не длиннее 50 символов.'});
  if(city!==null&&(typeof city!=='string'||city.trim().length>80)) return res.status(400).json({error:'Укажи корректный город.'});
  if(photoUrl!==null){
    if(typeof photoUrl!=='string'||photoUrl.length>28000000) return res.status(400).json({error:'Фото профиля должно быть безопасной HTTPS-ссылкой или изображением размером до 20 МБ.'});
    if(!/^https:\/\//i.test(photoUrl)){
      const photoValidation=validateListingMedia(photoUrl,'image',20*1024*1024);
      if(!photoValidation.valid)return res.status(400).json({error:'Фото профиля должно быть безопасной HTTPS-ссылкой или изображением размером до 3 МБ.'});
    }
  }
  if(profileTextProblem([bio,city,...interests])) return res.status(400).json({error:'В профиле найдены запрещённые ругательства, оскорбления или пошлые слова. Исправь текст.'});
  if(gender!==null&&!['woman','man','nonbinary','prefer_not_to_say'].includes(gender)) return res.status(400).json({error:'Invalid gender'});
  const d = typeof birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? new Date(birthDate + 'T00:00:00Z') : null;
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== birthDate || birthDate > new Date().toISOString().slice(0,10)) return res.status(400).json({error:'Укажи корректную дату рождения, чтобы создать профиль.'});
  const age = ageOnDate(birthDate);
  if (age === null || age < 14) return res.status(403).json({error:'VIBE доступен с 14 лет. Проверь дату рождения в профиле.'});
  if (age > 100) return res.status(400).json({error:'Проверь дату рождения в профиле.'});
  const q=await pool.query(`UPDATE users SET birth_date=$1,age_confirmed=$2,gender=$3,bio=$4,city=$5,photo_url=COALESCE($6,photo_url),goal=$7,interests=$8,updated_at=NOW()
    WHERE id=$9 RETURNING id,username,first_name,birth_date,age_verification_status,gender,bio,city,photo_url,goal,interests,discoverable`,
    [birthDate,Boolean(birthDate),gender,bio.trim(),city?.trim()||null,photoUrl,goal,interests.map(value=>value.trim()),req.user.id]);
  res.json({user:q.rows[0],route:age<18?'youth':'adult_verification',adultAccess:false});
}));

async function getUserAgeBand(userId) {
  const q = await pool.query('SELECT birth_date,verified_birth_date,age_verification_status FROM users WHERE id=$1', [userId]);
  if (!q.rowCount) return 'restricted';
  const u = q.rows[0];
  return ageBandForUser({
    birthDate: u.birth_date,
    verifiedBirthDate: u.verified_birth_date,
    verificationStatus: u.age_verification_status
  });
}

async function hasMutualLike(userId, otherId) {
  const q = await pool.query(
    'SELECT 1 FROM likes a JOIN likes b ON b.from_user=a.to_user AND b.to_user=a.from_user WHERE a.from_user=$1 AND a.to_user=$2 LIMIT 1',
    [userId, otherId]
  );
  return q.rowCount > 0;
}

app.get('/api/age-status',auth,wrap(async(req,res)=>{
  const q=await pool.query('SELECT birth_date,verified_birth_date,age_verification_status FROM users WHERE id=$1',[req.user.id]);
  const u=q.rows[0];
  const ageBand=ageBandForUser({birthDate:u.birth_date,verifiedBirthDate:u.verified_birth_date,verificationStatus:u.age_verification_status});
  const adultAccess=ageBand==='adult';
  const selfAge=ageOnDate(u.birth_date);
  const route=ageBand==='adult'?'adult':ageBand==='teen'?'teen':!u.birth_date?'age_gate':selfAge!==null&&selfAge<14?'underage':'adult_verification';
  res.json({route,ageBand,adultAccess,status:u.age_verification_status});
}));

app.get('/api/stories',auth,userActionRateLimit,wrap(async(req,res)=>{
 await pool.query('DELETE FROM stories WHERE expires_at <= NOW()');
 const viewerBand=await getUserAgeBand(req.user.id);
 const q=await pool.query(`SELECT s.id,s.user_id AS author_id,s.media_url,s.media_type,s.caption,s.created_at,s.expires_at,u.first_name AS name
   FROM stories s JOIN users u ON u.id=s.user_id
   WHERE s.expires_at>NOW()
     AND u.account_status='active'
     AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
     AND (
       s.user_id=$1
       OR ($2='teen' AND COALESCE(u.age_verification_status,'') <> 'verified'
           AND u.birth_date > CURRENT_DATE-INTERVAL '18 years'
           AND u.birth_date <= CURRENT_DATE-INTERVAL '14 years')
       OR ($2='adult' AND u.age_verification_status='verified'
           AND u.verified_birth_date IS NOT NULL
           AND u.verified_birth_date <= CURRENT_DATE-INTERVAL '18 years')
     )
   ORDER BY s.created_at DESC LIMIT 100`,[req.user.id,viewerBand]);
 res.json({stories:q.rows.map(s=>({...s,is_mine:String(s.author_id)===String(req.user.id)}))});
}));
app.post('/api/stories',auth,storyRateLimit,wrap(async(req,res)=>{
 await pool.query('DELETE FROM stories WHERE expires_at <= NOW()');
 const viewerBand=await getUserAgeBand(req.user.id);
 if(!['teen','adult'].includes(viewerBand))return res.status(403).json({error:'Истории доступны после подтверждения подходящей возрастной группы.'});
 const {mediaUrl,mediaType='image',caption=''}=req.body||{};
 if(typeof mediaUrl!=='string'||mediaUrl.length>4_300_000||!['data:image/jpeg;base64,','data:image/png;base64,','data:image/webp;base64,','data:video/mp4;base64,','data:video/webm;base64,'].some(prefix=>mediaUrl.startsWith(prefix)))return res.status(400).json({error:'Выбери фото или видео подходящего формата размером до 3 МБ.'});
 if(!['image','video'].includes(mediaType)||((mediaUrl.startsWith('data:video/')?'video':'image')!==mediaType))return res.status(400).json({error:'Тип файла не совпадает с медиа.'});
 const mediaValidation=validateListingMedia(mediaUrl,mediaType);
 if(!mediaValidation.valid)return res.status(400).json({error:'Файл истории повреждён или имеет неподдерживаемый формат.'});
 if(typeof caption!=='string'||caption.length>180)return res.status(400).json({error:'Подпись должна быть не длиннее 180 символов.'});
 if(profileTextProblem([caption]))return res.status(400).json({error:'В подписи найдены запрещённые слова. Исправь текст.'});
 const q=await pool.query("INSERT INTO stories(user_id,media_url,media_type,caption,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '24 hours') RETURNING id,user_id AS author_id,media_url,media_type,caption,created_at,expires_at",[req.user.id,mediaUrl,mediaType,caption.trim()]);
 const s=q.rows[0];res.status(201).json({story:{...s,name:req.user.first_name||'Ты',is_mine:true}});
}));
app.get('/api/listings/mine',auth,wrap(async(req,res)=>{
 const q=await pool.query(`SELECT l.user_id AS id,l.name,l.age,l.city,l.country,l.hobbies,l.description,l.media_url,l.media_type,l.status,l.created_at,l.updated_at,l.id AS listing_id FROM listings l WHERE l.user_id=$1`,[req.user.id]);
 res.json({listing:q.rows[0]||null});
}));
app.delete('/api/listings/mine',auth,userActionRateLimit,wrap(async(req,res)=>{
 const deleted=await pool.query('DELETE FROM listings WHERE user_id=$1 RETURNING id',[req.user.id]);
 if(!deleted.rowCount)return res.status(404).json({error:'У тебя пока нет анкеты для удаления.'});
 res.json({ok:true,deleted:true});
}));
app.post('/api/listings',auth,userActionRateLimit,wrap(async(req,res)=>{
 const {name,age,city,country,hobbies='',description='',mediaUrl=null,mediaType='image'}=req.body||{};
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>60)return res.status(400).json({error:'Имя анкеты должно содержать от 2 до 60 символов.'});
 const profileCheck=await pool.query('SELECT birth_date,verified_birth_date,age_verification_status FROM users WHERE id=$1',[req.user.id]);
 if(!profileCheck.rows[0]?.birth_date)return res.status(400).json({error:'Сначала заполни профиль и укажи дату рождения.'});
 const ageSource=profileCheck.rows[0].age_verification_status==='verified'&&profileCheck.rows[0].verified_birth_date
   ? profileCheck.rows[0].verified_birth_date : profileCheck.rows[0].birth_date;
 const actualAge=ageOnDate(ageSource);
 if(actualAge===null||actualAge<14||actualAge>100)return res.status(403).json({error:'VIBE доступен с 14 лет. Проверь дату рождения в профиле.'});
 if(actualAge>=18&&profileCheck.rows[0].age_verification_status!=='verified')return res.status(403).json({error:'Для взрослой возрастной группы сначала требуется подтверждение возраста.'});
 if(!Number.isInteger(Number(age))||Number(age)!==actualAge)return res.status(400).json({error:'Возраст анкеты должен совпадать с датой рождения: '+actualAge+'.'});

 if(typeof city!=='string'||city.trim().length<2||city.trim().length>80||typeof country!=='string'||country.trim().length<2||country.trim().length>80)return res.status(400).json({error:'Укажи город и страну.'});
 if(typeof hobbies!=='string'||hobbies.length>300||typeof description!=='string'||description.length>1000)return res.status(400).json({error:'Хобби — до 300, описание — до 1000 символов.'});
 const mediaValidation=validateListingMedia(mediaUrl,mediaType);
 if(!mediaValidation.valid)return res.status(400).json({error:'Медиа должно быть корректным фото или видео размером до 3 МБ, а тип файла должен совпадать с выбранным типом.'});
 if(profileTextProblem([name,city,country,hobbies,description]))return res.status(400).json({error:'В анкете найдены запрещённые ругательства или пошлые слова. Исправь текст.'});
 const q=await pool.query(`INSERT INTO listings(user_id,name,age,city,country,hobbies,description,media_url,media_type,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
 ON CONFLICT(user_id) DO UPDATE SET name=EXCLUDED.name,age=EXCLUDED.age,city=EXCLUDED.city,country=EXCLUDED.country,hobbies=EXCLUDED.hobbies,description=EXCLUDED.description,media_url=EXCLUDED.media_url,media_type=EXCLUDED.media_type,status='pending',updated_at=NOW()
 RETURNING id,user_id,name,age,city,country,hobbies,description,media_url,media_type,status,created_at,updated_at`,[req.user.id,name.trim(),Number(age),city.trim(),country.trim(),hobbies.trim(),description.trim(),mediaUrl,mediaType]);
 const listing=q.rows[0];
 if(process.env.BOT_TOKEN){
   try {
     const staff=await pool.query("SELECT telegram_id FROM admin_roles WHERE role IN ('helper','moderator','admin','chief_admin')");
     const ids=new Set([DEVELOPER_TELEGRAM_ID,...(process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean),...staff.rows.map(x=>String(x.telegram_id))]);
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
       if(listing.media_url){
         try {
           const isVideo=listing.media_type==='video';
           const endpoint='https://api.telegram.org/bot'+process.env.BOT_TOKEN+(isVideo?'/sendVideo':'/sendPhoto');
           const match=listing.media_url.match(/^data:(image\/[a-zA-Z0-9.+-]+|video\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
           if(match){
             const form=new FormData();form.append('chat_id',String(chatId));
             form.append(isVideo?'video':'photo',new Blob([Buffer.from(match[2],'base64')],{type:match[1]}),isVideo?'listing-media.mp4':'listing-media.jpg');
             form.append('caption','Медиа для проверки анкеты #'+listing.id+' · '+(isVideo?'видео':'фото'));
             const mediaResult=await fetch(endpoint,{method:'POST',body:form});
             if(!mediaResult.ok)console.error('Listing media moderation upload failed:',await mediaResult.text());
           }
         } catch(e) { console.error('Listing media moderation notification failed:',e.message); }
       }
       return fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:details,parse_mode:'HTML',reply_markup:keyboard})}).catch(e=>console.error('Listing notification failed:',e.message));
     }));
   } catch(e) { console.error('Listing moderation notification failed:',e.message); }
 }
 res.status(201).json({listing});
}));
app.get('/api/discover',auth,wrap(async(req,res)=>{
   const viewerBand=await getUserAgeBand(req.user.id);
   // Let a user preview their own listing even before age verification is complete.
   // This does not expose the listing to other users or bypass age-group filtering.
   if(!['teen','adult'].includes(viewerBand)){
     const own=await pool.query(`
       SELECT l.user_id AS id,l.id AS listing_id,l.user_id,l.name,l.age,l.city,l.country,l.hobbies,l.description,l.media_url,l.media_type,l.status,l.created_at,u.photo_url,u.username,u.goal,u.interests AS profile_interests,
         CASE WHEN u.telegram_id::text=$2 THEN 'developer' ELSE COALESCE(NULLIF(u.public_status,''),'none') END AS public_role
       FROM listings l JOIN users u ON u.id=l.user_id
       WHERE l.user_id=$1 AND u.account_status='active'
       LIMIT 1
     `,[req.user.id,DEVELOPER_TELEGRAM_ID]);
     return res.json({people:own.rows.map(p=>({...p,role_label:p.public_role==='developer'?'Разработчик':(PUBLIC_STATUS_LABELS[p.public_role]||null),bio:p.description,interests:[...(p.profile_interests||[]),...(p.hobbies?p.hobbies.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean):[])].filter((value,index,array)=>value&&array.findIndex(item=>item.toLocaleLowerCase()===value.toLocaleLowerCase())===index)}))});
   }
   const q=await pool.query(`
     WITH viewer AS (
       SELECT city, verified_birth_date, goal, interests
       FROM users WHERE id=$1
     ),
     candidates AS (
       SELECT l.user_id AS id,l.id AS listing_id,l.user_id,l.name,l.age,l.city,l.country,l.hobbies,l.description,l.media_url,l.media_type,l.status,l.created_at,u.photo_url,u.username,u.goal,u.interests AS profile_interests,
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
           ($3='teen' AND l.age BETWEEN 14 AND 17
               AND COALESCE(u.age_verification_status,'') <> 'verified'
               AND u.birth_date > CURRENT_DATE-INTERVAL '18 years'
               AND u.birth_date <= CURRENT_DATE-INTERVAL '14 years')
           OR ($3='adult' AND l.age >= 18 AND u.age_verification_status='verified'
               AND u.verified_birth_date IS NOT NULL
               AND u.verified_birth_date <= CURRENT_DATE-INTERVAL '18 years')
         )))
     )
     SELECT * FROM candidates
     ORDER BY CASE WHEN user_id=$1 THEN 1 ELSE 0 END, RANDOM()
     LIMIT 50
   `,[req.user.id,DEVELOPER_TELEGRAM_ID,viewerBand]);
   res.json({people:q.rows.map(p=>({...p,role_label:p.public_role==='developer'?'Разработчик':(PUBLIC_STATUS_LABELS[p.public_role]||null),bio:p.description,interests:[...(p.profile_interests||[]),...(p.hobbies?p.hobbies.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean):[])].filter((value,index,array)=>value&&array.findIndex(item=>item.toLocaleLowerCase()===value.toLocaleLowerCase())===index)}))});
 }));
app.post('/api/likes/:userId',auth,userActionRateLimit,wrap(async(req,res)=>{
  const id=Number(req.params.userId);
  const isDeveloper=String(req.user.telegram_id)===DEVELOPER_TELEGRAM_ID;
  // Developer-only self-test returns a simulated success and does not write fake likes.
  if(isDeveloper && id===Number(req.user.id)) return res.json({liked:true,matched:true,testMode:true,message:'Developer self-like test passed'});
  if(!Number.isSafeInteger(id)||id===req.user.id)return res.status(400).json({error:'Invalid user'});
  const viewerBand=await getUserAgeBand(req.user.id), targetBand=await getUserAgeBand(id);
  if(!['teen','adult'].includes(viewerBand)||targetBand!==viewerBand)return res.status(403).json({error:'Симпатии доступны только пользователям твоей возрастной стороны VIBE.'});
  const q=await pool.query(`SELECT u.id FROM users u WHERE u.id=$1 AND u.account_status='active'
    AND EXISTS(SELECT 1 FROM listings l WHERE l.user_id=u.id AND l.status='published')`,[id]);
  if(!q.rowCount)return res.status(404).json({error:'Пользователь или опубликованная анкета недоступны'});
  const blocked=await pool.query('SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[req.user.id,id]);
  if(blocked.rowCount)return res.status(403).json({error:'Нельзя поставить лайк этому пользователю'});
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
      AND (($3='teen' AND COALESCE(u.age_verification_status,'') <> 'verified' AND u.birth_date > CURRENT_DATE-INTERVAL '18 years' AND u.birth_date <= CURRENT_DATE-INTERVAL '14 years') OR ($3='adult' AND u.age_verification_status='verified' AND u.verified_birth_date<=CURRENT_DATE-INTERVAL '18 years'))
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
      ORDER BY l.created_at DESC LIMIT 50`,[req.user.id,DEVELOPER_TELEGRAM_ID,viewerBand]),
    pool.query(`SELECT u.id AS id,lst.id AS listing_id,lst.name,lst.age,lst.city,lst.country,lst.hobbies,lst.description,u.photo_url,
      CASE WHEN u.telegram_id::text=$2 THEN 'developer' ELSE COALESCE(NULLIF(u.public_status,''),'none') END AS public_role
      FROM likes l JOIN users u ON u.id=l.to_user JOIN listings lst ON lst.user_id=u.id
      WHERE l.from_user=$1 AND lst.status='published' AND u.account_status='active'
      AND (($3='teen' AND COALESCE(u.age_verification_status,'') <> 'verified' AND u.birth_date > CURRENT_DATE-INTERVAL '18 years' AND u.birth_date <= CURRENT_DATE-INTERVAL '14 years') OR ($3='adult' AND u.age_verification_status='verified' AND u.verified_birth_date<=CURRENT_DATE-INTERVAL '18 years'))
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
      ORDER BY l.created_at DESC LIMIT 50`,[req.user.id,DEVELOPER_TELEGRAM_ID,viewerBand])
  ]);
  const normalize = rows => rows.map(p=>({...p,role_label:p.public_role==='developer'?'Разработчик':(PUBLIC_STATUS_LABELS[p.public_role]||null),interests:p.hobbies?p.hobbies.split(',').map(x=>x.trim()).filter(Boolean):[]}));
  res.json({incoming:normalize(incoming.rows),outgoing:normalize(outgoing.rows)});
}));
app.get('/api/chats',auth,wrap(async(req,res)=>{
  const viewerBand=await getUserAgeBand(req.user.id);
  if(!['teen','adult'].includes(viewerBand))return res.json({chats:[]});
  const q=await pool.query(`SELECT u.id AS user_id,l.name AS first_name,u.username,u.photo_url,
    (SELECT m.body FROM messages m WHERE m.match_low=LEAST($1,u.id) AND m.match_high=GREATEST($1,u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message,
    (SELECT m.created_at FROM messages m WHERE m.match_low=LEAST($1,u.id) AND m.match_high=GREATEST($1,u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
    FROM users u JOIN listings l ON l.user_id=u.id AND l.status='published'
    WHERE u.id<>$1 AND u.account_status='active'
      AND (($2='teen' AND COALESCE(u.age_verification_status,'') <> 'verified' AND u.birth_date > CURRENT_DATE-INTERVAL '18 years' AND u.birth_date <= CURRENT_DATE-INTERVAL '14 years') OR ($2='adult' AND u.age_verification_status='verified' AND u.verified_birth_date<=CURRENT_DATE-INTERVAL '18 years'))
      AND (
        EXISTS (SELECT 1 FROM likes a JOIN likes b ON b.from_user=a.to_user AND b.to_user=a.from_user WHERE a.from_user=$1 AND a.to_user=u.id)
        OR EXISTS (SELECT 1 FROM messages m WHERE m.match_low=LEAST($1,u.id) AND m.match_high=GREATEST($1,u.id))
      )
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
    ORDER BY last_message_at DESC NULLS LAST,u.first_name ASC`,[req.user.id,viewerBand]);
  res.json({chats:q.rows});
}));
app.get('/api/chats/:userId/messages',auth,wrap(async(req,res)=>{
  const other=Number(req.params.userId);
  const isDeveloper=String(req.user.telegram_id)===DEVELOPER_TELEGRAM_ID;
  if(isDeveloper && other===Number(req.user.id)) return res.json({messages:[],testMode:true});
  if(!Number.isSafeInteger(other)||other===Number(req.user.id))return res.status(400).json({error:'Invalid user'});
  const viewerBand=await getUserAgeBand(req.user.id), targetBand=await getUserAgeBand(other);
  if(!['teen','adult'].includes(viewerBand)||targetBand!==viewerBand)return res.status(403).json({error:'Личные сообщения доступны только внутри твоей возрастной стороны VIBE.'});
  const target=await pool.query("SELECT u.id FROM users u WHERE u.id=$1 AND u.account_status='active' AND EXISTS (SELECT 1 FROM listings l WHERE l.user_id=u.id AND l.status='published')",[other]);
  if(!target.rowCount)return res.status(404).json({error:'Пользователь недоступен или его анкета не опубликована'});
  const blocked=await pool.query('SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[req.user.id,other]);
  if(blocked.rowCount)return res.status(403).json({error:'Переписка недоступна'});
  const q=await pool.query(`SELECT id,sender_id,body,created_at FROM (SELECT id,sender_id,body,created_at FROM messages WHERE match_low=LEAST($1,$2) AND match_high=GREATEST($1,$2) ORDER BY created_at DESC LIMIT 200) recent_messages ORDER BY created_at ASC`,[req.user.id,other]);
  res.json({messages:q.rows});
}));
app.post('/api/chats/:userId/messages',auth,userActionRateLimit,wrap(async(req,res)=>{
  const other=Number(req.params.userId); const body=req.body?.body;
  const isDeveloper=String(req.user.telegram_id)===DEVELOPER_TELEGRAM_ID;
  if(!Number.isSafeInteger(other)||typeof body!=='string'||!body.trim()||body.trim().length>4000)return res.status(400).json({error:'Некорректное сообщение'});
  if(profileTextProblem([body]))return res.status(400).json({error:'Сообщение содержит запрещённые ругательства, оскорбления или пошлые выражения. Измени текст и попробуй снова.'});
  if(isDeveloper && other===Number(req.user.id)) return res.status(201).json({message:{id:'test-'+Date.now(),sender_id:req.user.id,body:body.trim(),created_at:new Date().toISOString()},testMode:true});
  if(other===Number(req.user.id))return res.status(400).json({error:'Invalid user'});
  const viewerBand=await getUserAgeBand(req.user.id), targetBand=await getUserAgeBand(other);
  if(!['teen','adult'].includes(viewerBand)||targetBand!==viewerBand)return res.status(403).json({error:'Личные сообщения доступны только внутри твоей возрастной стороны VIBE.'});
  const target=await pool.query("SELECT u.id FROM users u WHERE u.id=$1 AND u.account_status='active' AND EXISTS (SELECT 1 FROM listings l WHERE l.user_id=u.id AND l.status='published')",[other]);
  if(!target.rowCount)return res.status(404).json({error:'Пользователь недоступен или его анкета не опубликована'});
  const blocked=await pool.query('SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[req.user.id,other]);
  if(blocked.rowCount)return res.status(403).json({error:'Нельзя отправить сообщение этому пользователю'});
  const priorMessages=await pool.query(`SELECT COUNT(*) FILTER (WHERE sender_id=$1)::int AS sent,COUNT(*) FILTER (WHERE sender_id=$2)::int AS received FROM messages WHERE match_low=LEAST($1,$2) AND match_high=GREATEST($1,$2)`,[req.user.id,other]);
  if(Number(priorMessages.rows[0]?.sent||0)>0&&Number(priorMessages.rows[0]?.received||0)===0)return res.status(429).json({error:'Первое сообщение уже отправлено. Дождись ответа или заблокируй пользователя.'});
  const q=await pool.query(`INSERT INTO messages(match_low,match_high,sender_id,body) VALUES(LEAST($1,$2),GREATEST($1,$2),$1,$3) RETURNING id,sender_id,body,created_at`,[req.user.id,other,body.trim()]);
  res.status(201).json({message:q.rows[0]});
}));
app.post('/api/blocks/:userId',auth,userActionRateLimit,wrap(async(req,res)=>{
  const id=Number(req.params.userId);
  if(!Number.isSafeInteger(id)||id===req.user.id)return res.status(400).json({error:'Invalid user'});
  const target=await pool.query("SELECT id FROM users WHERE id=$1 AND account_status='active'",[id]);
  if(!target.rowCount)return res.status(404).json({error:'Пользователь не найден или недоступен'});
  await pool.query('INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,id]);
  await pool.query('DELETE FROM likes WHERE (from_user=$1 AND to_user=$2) OR (from_user=$2 AND to_user=$1)',[req.user.id,id]);
  res.json({blocked:true});
}));
app.post('/api/reports/demo',auth,reportRateLimit,wrap(async(req,res)=>{
  const {reason,details='',reporterUsername,evidence='',targetName='Демо-профиль',targetUsername='',targetAge=null,reportType='profile'}=req.body||{};
  if(typeof reason!=='string'||!reason.trim()||reason.trim().length>100)return res.status(400).json({error:'Укажи обязательную причину жалобы'});
  if(typeof details!=='string'||details.length>1000)return res.status(400).json({error:'Подробности жалобы — не более 1000 символов'});
  if(!['profile','post'].includes(reportType))return res.status(400).json({error:'Неизвестный тип жалобы'});
  const reportReasonLabels = {
    spam: 'Спам или навязчивая реклама',
    scam: 'Мошенничество или попытка обмана',
    harassment: 'Оскорбления, травля или преследование',
    threats: 'Угрозы или запугивание',
    hate_speech: 'Разжигание ненависти или дискриминация',
    sexual: 'Сексуальные домогательства или нежелательные сообщения',
    inappropriate: 'Неприемлемый или откровенный контент',
    fake: 'Поддельная анкета или выдача себя за другого',
    impersonation: 'Использование чужих фото или личности',
    privacy: 'Публикация личных данных без согласия',
    underage: 'Нарушение правил возрастных групп',
    dangerous: 'Опасный или незаконный контент',
    other: 'Другая причина'
  };
  const reportReasonLabel = reportReasonLabels[reason.trim()];
  if(!reportReasonLabel)return res.status(400).json({error:'Выбери причину из списка жалоб'});
  const evidenceValidation=validateReportEvidence(evidence);
  if(!evidenceValidation.valid)return res.status(400).json({error:'Доказательство должно быть корректным фото, видео или PDF размером не более 2 МиБ.'});
  if(!process.env.BOT_TOKEN)return res.status(503).json({error:'Не удалось отправить жалобу: бот временно недоступен.'});
  const reporterHandle=(req.user.username||'').trim()||('vibe-user-'+req.user.id);
  const safeName=String(targetName).slice(0,80);
  const safeUsername=String(targetUsername).replace(/[^A-Za-z0-9_@]/g,'').slice(0,40);
  const reportText=['🚨 Жалоба на демо-профиль VIBE','Тип: '+(reportType==='post'?'публикация':'профиль'),'Профиль: '+safeName+(targetAge?' · '+Number(targetAge):'')+(safeUsername?' (@'+safeUsername.replace(/^@/,'')+')':''),'От: '+(req.user.first_name||'пользователь')+' ('+reporterHandle+')','Telegram ID отправителя: '+req.user.id,'Причина: '+reportReasonLabel,'Подробности: '+(details.trim()||'—'),'Доказательства: '+(evidence?'прикреплены в форме':'не приложены'),'Рассмотреть жалобу вручную; демо-профиль не является записью реального пользователя в базе.'].join(String.fromCharCode(10));
  await pool.query(`CREATE TABLE IF NOT EXISTS demo_reports (id BIGSERIAL PRIMARY KEY, reporter_id BIGINT NOT NULL, reporter_username TEXT NOT NULL DEFAULT '', target_name TEXT NOT NULL, target_username TEXT NOT NULL DEFAULT '', target_age INTEGER, reason TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', evidence TEXT, report_type TEXT NOT NULL DEFAULT 'profile', status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const saved=await pool.query('INSERT INTO demo_reports(reporter_id,reporter_username,target_name,target_username,target_age,reason,details,evidence,report_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[req.user.id,reporterHandle,safeName,safeUsername,targetAge?Number(targetAge):null,reportReasonLabel,details.trim(),evidence||null,reportType]);
  const staff=await pool.query("SELECT telegram_id FROM admin_roles WHERE role IN ('chief_admin','admin','moderator')");
  const recipients=new Set([DEVELOPER_TELEGRAM_ID,...(process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean),...staff.rows.map(row=>String(row.telegram_id))]);
  const deliveries=await Promise.all([...recipients].map(async chat_id=>{
    try {
      const sent=await fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id,text:reportText})});
      const result=await sent.json().catch(()=>({}));
      if(!sent.ok||!result.ok)console.error('Demo report notification rejected:',String(chat_id),result.description||sent.status);
      return sent.ok&&result.ok;
    } catch(e) { console.error('Demo report notification failed:',String(chat_id),e.message); return false; }
  }));
  const notificationSent=deliveries.some(Boolean);
  if(!notificationSent)console.error('Demo report #'+saved.rows[0].id+' saved, but no admin notification was delivered.');
  res.status(201).json({ok:true,reported:true,reportId:saved.rows[0].id,review:'saved',notificationSent,message:notificationSent?'Тестовая жалоба сохранена и отправлена команде.':'Тестовая жалоба сохранена, но уведомление команде не доставлено. Повторно отправлять её не нужно.'});
}));
app.post('/api/reports/:userId',auth,reportRateLimit,wrap(async(req,res)=>{
  const id=Number(req.params.userId);
  const {reason,details='',reporterUsername,reportedUsername,evidence='',reportType='profile',listingId=null}=req.body||{};
  if(!Number.isSafeInteger(id)||id===Number(req.user.id))return res.status(400).json({error:'Некорректный пользователь для жалобы'});
  if(typeof reason!=='string'||!reason.trim()||reason.trim().length>100)return res.status(400).json({error:'Укажи обязательную причину жалобы'});
  if(typeof details!=='string'||details.length>1000)return res.status(400).json({error:'Подробности жалобы — не более 1000 символов'});
  if(reporterUsername!==undefined && reporterUsername!==null && reporterUsername!=='' && (typeof reporterUsername!=='string'||!/^@?[A-Za-z0-9_]{3,32}$/.test(reporterUsername.trim())))return res.status(400).json({error:'Некорректный Telegram-юзернейм отправителя'});
  if(reportedUsername!==undefined && reportedUsername!==null && reportedUsername!=='' && (typeof reportedUsername!=='string'||!/^@?[A-Za-z0-9_]{3,32}$/.test(reportedUsername.trim())))return res.status(400).json({error:'Некорректный Telegram-юзернейм пользователя'});  if(!['profile','post'].includes(reportType))return res.status(400).json({error:'Неизвестный тип жалобы'});
  const evidenceValidation=validateReportEvidence(evidence);
  if(!evidenceValidation.valid)return res.status(400).json({error:'Доказательство должно быть корректным фото, видео или PDF размером не более 2 МиБ.'});
  const targetExists=await pool.query("SELECT id,first_name,username FROM users WHERE id=$1 AND account_status='active'",[id]);
  if(!targetExists.rowCount)return res.status(404).json({error:'Профиль не найден или недоступен'});
  const allowedReasons={
    spam:'Спам или навязчивая реклама',
    scam:'Мошенничество или попытка обмана',
    harassment:'Оскорбления, травля или преследование',
    threats:'Угрозы или запугивание',
    hate_speech:'Разжигание ненависти или дискриминация',
    sexual:'Сексуальные домогательства или нежелательные сообщения',
    inappropriate:'Неприемлемый или откровенный контент',
    fake:'Поддельная анкета или выдача себя за другого',
    impersonation:'Использование чужих фото или личности',
    privacy:'Публикация личных данных без согласия',
    underage:'Нарушение правил возрастных групп',
    dangerous:'Опасный или незаконный контент',
    other:'Другая причина'
  };
  const reasonLabel=allowedReasons[reason.trim()];
  if(!reasonLabel)return res.status(400).json({error:'Выбери причину из списка жалоб'});
  const authenticatedHandle=(req.user.username||'').trim();
  const suppliedReporterHandle=typeof reporterUsername==='string'?reporterUsername.trim().replace(/^@/,''):'';
  if(suppliedReporterHandle&&authenticatedHandle&&suppliedReporterHandle.toLowerCase()!==authenticatedHandle.toLowerCase())return res.status(400).json({error:'Указанный отправитель не совпадает с аккаунтом Telegram'});
  const actualTargetHandle=(targetExists.rows[0].username||'').trim();
  const suppliedTargetHandle=typeof reportedUsername==='string'?reportedUsername.trim().replace(/^@/,''):'';
  if(suppliedTargetHandle&&actualTargetHandle&&suppliedTargetHandle.toLowerCase()!==actualTargetHandle.toLowerCase())return res.status(400).json({error:'Юзернейм не совпадает с выбранным профилем'});
  const reporterHandle=authenticatedHandle||('vibe-user-'+req.user.id);
  const reportedHandle=actualTargetHandle||('vibe-user-'+id);
  const safeListingId=listingId===null?null:Number(listingId);
  if(safeListingId!==null&&(!Number.isSafeInteger(safeListingId)||safeListingId<1))return res.status(400).json({error:'Некорректная публикация'});
  if(reportType==='post'){
    if(safeListingId===null)return res.status(400).json({error:'Не удалось определить публикацию'});
    const post=await pool.query('SELECT id FROM listings WHERE id=$1 AND user_id=$2',[safeListingId,id]);
    if(!post.rowCount)return res.status(400).json({error:'Публикация не принадлежит выбранному профилю'});
  }
  const inserted=await pool.query('INSERT INTO reports(reporter_id,reported_id,reason,details,reporter_telegram_username,reported_telegram_username,evidence,report_type,listing_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[req.user.id,id,reasonLabel,details.trim(),reporterHandle,reportedHandle,evidence,reportType,safeListingId]);
  if(!process.env.BOT_TOKEN){
    console.error('Report #'+inserted.rows[0].id+' saved, but BOT_TOKEN is missing; admin notification not sent.');
    return res.status(503).json({error:'Жалоба сохранена, но уведомление администрации не отправлено. Команда уже получила технический сигнал.'});
  }
  let delivered=0;
  try{
    const roles=await pool.query("SELECT telegram_id FROM admin_roles WHERE role IN ('chief_admin','admin','moderator')");
    const ids=new Set([DEVELOPER_TELEGRAM_ID,...(process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean),...roles.rows.map(x=>String(x.telegram_id))]);
    const target=targetExists.rows[0];
    const reportText=['🚨 Новая жалоба VIBE #'+inserted.rows[0].id,'Тип: '+(reportType==='post'?'на публикацию':'на профиль'),'На пользователя: '+(target.first_name||'неизвестно')+' ('+(target.username?'@'+reportedHandle:reportedHandle)+')','От: '+(req.user.first_name||'пользователь')+' ('+reporterHandle+')','Причина: '+reasonLabel,'Подробности: '+(details.trim()||'—'),'Доказательства: '+(evidence?'сохранены в системе; откройте панель жалоб':'не приложены'),'Открой /reports в боте для модерации.'].join(String.fromCharCode(10));
    await Promise.all([...ids].map(async telegramId=>{
      try{
        const sent=await fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:telegramId,text:reportText})});
        const result=await sent.json().catch(()=>({}));
        if(!sent.ok||!result.ok){console.error('Report notification rejected for recipient',telegramId, result.description||sent.status);return;}
        delivered++;
        if(evidence){
          const match=evidence.match(/^data:([^;]+);base64,(.+)$/);
          if(match){
            const mime=match[1], bytes=Buffer.from(match[2],'base64');
            const kind=mime.startsWith('video/')?'video':mime==='application/pdf'?'document':mime.startsWith('image/')?'photo':null;
            if(kind){
              const form=new FormData();form.append('chat_id',String(telegramId));
              form.append(kind,new Blob([bytes],{type:mime}),'vibe-report-evidence.'+(mime==='application/pdf'?'pdf':mime.startsWith('video/')?'mp4':'jpg'));
              const attachment=await fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/send'+(kind==='photo'?'Photo':kind==='video'?'Video':'Document'),{method:'POST',body:form});
              const attachmentResult=await attachment.json().catch(()=>({}));
              if(!attachment.ok||!attachmentResult.ok) console.error('Report evidence delivery failed for recipient',telegramId,attachmentResult.description||attachment.status);
            }
          }
        }
      }catch(e){console.error('Report admin notification failed:',e.message);}
    }));
  }catch(e){console.error('Report admin notification failed:',e.message);}
  if(delivered===0){ console.error('Report #'+inserted.rows[0].id+' saved, but no admin notification was delivered.'); return res.status(201).json({reported:true,reportId:inserted.rows[0].id,notificationsDelivered:0,notificationSent:false,message:'Жалоба сохранена. Уведомление команде задерживается; повторно отправлять жалобу не нужно.'}); }
  res.status(201).json({reported:true,reportId:inserted.rows[0].id,notificationsDelivered:delivered,notificationSent:true});
}));

app.post('/api/appeals', auth, reportRateLimit, wrap(async (req,res) => {
  const appealType = typeof req.body?.appealType === 'string' ? req.body.appealType : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const listingId = req.body?.listingId == null ? null : Number(req.body.listingId);
  if (!['account','profile','listing'].includes(appealType)) return res.status(400).json({error:'Выбери корректный тип апелляции.'});
  if (message.length < 10 || message.length > 1500) return res.status(400).json({error:'Опиши причину апелляции сообщением от 10 до 1500 символов.'});
  if (appealType === 'account' && !['banned','restricted','suspended'].includes(req.user.account_status)) return res.status(400).json({error:'У аккаунта нет блокировки или ограничения, которое можно обжаловать.'});
  if (appealType === 'profile' && !['restricted','flagged','reviewing'].includes(req.user.profile_review_status)) return res.status(400).json({error:'Для анкеты сейчас нет решения, которое можно обжаловать.'});
  if (appealType === 'listing') {
    if (!Number.isSafeInteger(listingId) || listingId < 1) return res.status(400).json({error:'Укажи корректную публикацию.'});
    const listing = await pool.query('SELECT id,status FROM listings WHERE id=$1 AND user_id=$2',[listingId,req.user.id]);
    if (!listing.rowCount || !['rejected','hidden'].includes(listing.rows[0].status)) return res.status(400).json({error:'Можно обжаловать только отклонённую или скрытую публикацию своей анкеты.'});
  }
  const saved = await pool.query("INSERT INTO moderation_appeals(user_id,appeal_type,listing_id,message) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",[req.user.id,appealType,listingId,message]);
  if (!saved.rowCount) return res.status(409).json({error:'У тебя уже есть открытая апелляция. Дождись решения команды.'});
  const staff = await pool.query("SELECT telegram_id FROM admin_roles WHERE role IN ('chief_admin','admin','moderator')");
  const recipients = new Set([DEVELOPER_TELEGRAM_ID,...(process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean),...staff.rows.map(x=>String(x.telegram_id))]);
  const note = '⚖️ НОВАЯ АПЕЛЛЯЦИЯ VIBE #'+saved.rows[0].id+'\nТип: '+appealType+'\nПользователь ID: '+req.user.id+'\nПричина: '+message+'\n\nРассмотреть через панель администратора.';
  const deliveries = await Promise.all([...recipients].map(async chatId => { try { const r=await fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:note})});const j=await r.json().catch(()=>({}));return r.ok&&j.ok; } catch { return false; } }));
  if (!deliveries.some(Boolean)) console.error('Appeal #'+saved.rows[0].id+' saved but staff notification failed.');
  res.status(201).json({ok:true,appealId:saved.rows[0].id,notificationSent:deliveries.some(Boolean)});
}));
app.get('/api/admin/appeals', auth, adminOnly, wrap(async (_req,res) => {
  const rows = await pool.query("SELECT a.id,a.user_id,a.appeal_type,a.listing_id,a.message,a.status,a.decision_note,a.created_at,u.first_name,u.username FROM moderation_appeals a JOIN users u ON u.id=a.user_id WHERE a.status IN ('open','reviewing') ORDER BY a.created_at ASC LIMIT 100");
  res.json({appeals:rows.rows});
}));
app.post('/api/admin/appeals/:id/decision', auth, adminOnly, wrap(async (req,res) => {
  const id=Number(req.params.id), decision=req.body?.decision, note=typeof req.body?.note==='string'?req.body.note.trim().slice(0,1000):'';
  if(!Number.isSafeInteger(id)||id<1||!['approved','rejected','reviewing'].includes(decision)) return res.status(400).json({error:'Некорректное решение по апелляции.'});
  const result=await pool.query("UPDATE moderation_appeals SET status=$1,decision_note=$2,reviewed_by=$3,updated_at=NOW() WHERE id=$4 AND status IN ('open','reviewing') RETURNING id,user_id,appeal_type,listing_id,status",[decision,note,String(req.user.telegram_id),id]);
  if(!result.rowCount) return res.status(404).json({error:'Открытая апелляция не найдена.'});
  const appeal=result.rows[0];
  if(decision==='approved') {
    if(appeal.appeal_type==='account') await pool.query("UPDATE users SET account_status='active',moderation_note=NULL,updated_at=NOW() WHERE id=$1",[appeal.user_id]);
    if(appeal.appeal_type==='profile') await pool.query("UPDATE users SET profile_review_status='clear',updated_at=NOW() WHERE id=$1",[appeal.user_id]);
    if(appeal.appeal_type==='listing' && appeal.listing_id) await pool.query("UPDATE listings SET status='published',updated_at=NOW() WHERE id=$1 AND user_id=$2",[appeal.listing_id,appeal.user_id]);
  }
  await logModerationAction({actorId:req.user.telegram_id,actorRole:req.adminRole,action:'appeal_'+decision,targetUserId:appeal.user_id,listingId:appeal.listing_id,reason:note,metadata:{appealId:id}});
  const target=await pool.query('SELECT telegram_id,language FROM users WHERE id=$1',[appeal.user_id]);
  if(target.rowCount && target.rows[0].telegram_id && process.env.BOT_TOKEN) {
    const language=target.rows[0].language||'en';
    const messages={
      approved:{ru:'✅ Апелляция VIBE #'+id+' одобрена. Решение модерации пересмотрено.',en:'✅ VIBE appeal #'+id+' approved. The moderation decision has been reviewed.',de:'✅ VIBE-Einspruch #'+id+' genehmigt. Die Moderationsentscheidung wurde überprüft.'},
      rejected:{ru:'⚠️ Апелляция VIBE #'+id+' отклонена.',en:'⚠️ VIBE appeal #'+id+' rejected.',de:'⚠️ VIBE-Einspruch #'+id+' abgelehnt.'},
      reviewing:{ru:'ℹ️ Апелляция VIBE #'+id+' взята на дополнительное рассмотрение.',en:'ℹ️ VIBE appeal #'+id+' is under further review.',de:'ℹ️ VIBE-Einspruch #'+id+' wird weiter geprüft.'}
    };
    const suffix=note?({ru:'\\nКомментарий команды: ',en:'\\nTeam note: ',de:'\\nNachricht des Teams: '}[language]||'\\nTeam note: ')+note:'';
    const text=(messages[decision]?.[language]||messages[decision]?.en||messages.reviewing.en)+suffix;
    fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:target.rows[0].telegram_id,text})}).catch(error=>console.error('Appeal decision notification failed:',error.message));
  }
  res.json({ok:true,appeal});
}));

app.post('/api/admin/users/:code/ban',auth,adminOnly,wrap(async(req,res)=>{
  const code=String(req.params.code||'');
  const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';
  if(!/^\d{6}$/.test(code)) return res.status(400).json({error:'Введи ровно 6 цифр кода профиля'});
  if(!reason||reason.length>500) return res.status(400).json({error:'Укажи причину бана (до 500 символов)'});
  const target=await pool.query("SELECT id,first_name,username,telegram_id FROM users WHERE lpad(id::text,6,'0')=$1",[code]);
  if(!target.rowCount) return res.status(404).json({error:'Профиль с таким кодом не найден'});
  const targetUser=target.rows[0];
  if(String(targetUser.telegram_id)===DEVELOPER_TELEGRAM_ID) {
    await notifyDeveloperAttempt({actorId:req.user.telegram_id,actorName:req.user.first_name,actorUsername:req.user.username,action:'Бан разработчика',source:'Веб-панель модерации'});
    return res.status(403).json({error:'Разработчика нельзя забанить'});
  }
  const actorRole=await getRole(req.user.telegram_id);
  if((roleRank[actorRole]??0)<roleRank.moderator) return res.status(403).json({error:'Для блокировки аккаунтов нужна роль модератора или выше'});
  if(!await ensureTargetBelowActor(String(targetUser.telegram_id),actorRole)) return res.status(403).json({error:'Нельзя банить пользователя с равным или более высоким назначенным рангом'});
  const q=await pool.query("UPDATE users SET account_status='banned',discoverable=FALSE,moderation_note=$1,ban_issuer=$2,updated_at=NOW() WHERE id=$3 RETURNING id,first_name,username,telegram_id",[reason,actorRole==='developer'?'developer':'moderator',targetUser.id]);
  await logModerationAction({actorId:req.user.telegram_id,actorRole,action:'account_banned_api',targetUserId:targetUser.id,reason});
  res.json({banned:true,user:{...q.rows[0],profile_code:String(q.rows[0].id).padStart(6,'0')},reason});
}));
app.get('/api/admin/users/:code',auth,adminOnly,wrap(async(req,res)=>{
  const code=String(req.params.code||'');
  if(!/^\d{6}$/.test(code)) return res.status(400).json({error:'Введи ровно 6 цифр кода профиля'});
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
  if(typeof note!=='string'||(action==='ban'&&(!note.trim()||note.trim().length>500)))return res.status(400).json({error:'Укажи причину бана (до 500 символов)'});
  const c=await pool.connect();let targetTelegramId=null;
  try{
    await c.query('BEGIN');
    const f=await c.query('SELECT r.reported_id,u.telegram_id FROM reports r JOIN users u ON u.id=r.reported_id WHERE r.id=$1 FOR UPDATE OF r,u',[id]);
    if(!f.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Report not found'});}
    targetTelegramId=String(f.rows[0].telegram_id);
    if(action!=='none'&&!await ensureTargetBelowActor(targetTelegramId,req.adminRole)){
      await c.query('ROLLBACK');
      if(targetTelegramId===DEVELOPER_TELEGRAM_ID)await notifyDeveloperAttempt({actorId:req.user.telegram_id,actorName:req.user.first_name,actorUsername:req.user.username,action:'Модерация разработчика ('+action+')',source:'Веб-жалобы'});
      return res.status(403).json({error:'Нельзя изменять аккаунт сотрудника с равной или более высокой ролью'});
    }
    await c.query('UPDATE reports SET status=$1 WHERE id=$2',[status,id]);
    if(action!=='none'){
      const accountStatus={restrict:'restricted',suspend:'suspended',ban:'banned',restore:'active'}[action];
      await c.query("UPDATE users SET account_status=$1,moderation_note=$2,discoverable=CASE WHEN $1='active' THEN discoverable ELSE FALSE END,ban_issuer=CASE WHEN $1='banned' THEN $4 ELSE ban_issuer END,updated_at=NOW() WHERE id=$3",[accountStatus,note.trim()||'Admin action: '+action,f.rows[0].reported_id,req.adminRole==='developer'?'developer':'moderator']);
    }
    await c.query('COMMIT');res.json({updated:true});
  }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
}));
app.patch('/api/admin/flags/:id',auth,adminOnly,wrap(async(req,res)=>{
  const id=Number(req.params.id);const {status,action='none',note=''}=req.body||{};
  if(!Number.isSafeInteger(id)||!['reviewing','resolved','dismissed'].includes(status)||!['none','restrict','suspend','ban','restore'].includes(action))return res.status(400).json({error:'Invalid action'});
  if(typeof note!=='string'||(action==='ban'&&(!note.trim()||note.trim().length>500)))return res.status(400).json({error:'Укажи причину бана (до 500 символов)'});
  const c=await pool.connect();let targetTelegramId=null;
  try{
    await c.query('BEGIN');
    const f=await c.query('SELECT mf.user_id,u.telegram_id FROM moderation_flags mf JOIN users u ON u.id=mf.user_id WHERE mf.id=$1 FOR UPDATE OF mf,u',[id]);
    if(!f.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Flag not found'});}
    targetTelegramId=String(f.rows[0].telegram_id);
    if(action!=='none'&&!await ensureTargetBelowActor(targetTelegramId,req.adminRole)){
      await c.query('ROLLBACK');
      if(targetTelegramId===DEVELOPER_TELEGRAM_ID)await notifyDeveloperAttempt({actorId:req.user.telegram_id,actorName:req.user.first_name,actorUsername:req.user.username,action:'Модерация разработчика ('+action+')',source:'Веб-флаги модерации'});
      return res.status(403).json({error:'Нельзя изменять аккаунт сотрудника с равной или более высокой ролью'});
    }
    await c.query('UPDATE moderation_flags SET status=$1 WHERE id=$2',[status,id]);
    if(action!=='none'){
      const accountStatus={restrict:'restricted',suspend:'suspended',ban:'banned',restore:'active'}[action];
      await c.query("UPDATE users SET account_status=$1,moderation_note=$2,discoverable=CASE WHEN $1='active' THEN discoverable ELSE FALSE END,ban_issuer=CASE WHEN $1='banned' THEN $4 ELSE ban_issuer END,updated_at=NOW() WHERE id=$3",[accountStatus,note.trim()||'Admin action: '+action,f.rows[0].user_id,req.adminRole==='developer'?'developer':'moderator']);
    }
    await c.query('COMMIT');res.json({updated:true});
  }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
}));

app.post('/telegram/webhook', (req,res) => {
  if(req.get('X-Telegram-Bot-Api-Secret-Token')!==TELEGRAM_WEBHOOK_SECRET)return res.sendStatus(401);
  res.sendStatus(200);
  const m=req.body?.message, cb=req.body?.callback_query, token=process.env.BOT_TOKEN;
  if(!token||(!m?.chat?.id&&!cb?.message?.chat?.id))return;
  (async()=>{
    const from=m?.from||cb?.from, chatId=m?.chat?.id||cb?.message?.chat?.id, txt=(m?.text||'').trim();
    const parts=txt.split(/\s+/), cmd=(parts[0]||'').split('@')[0].toLowerCase(), arg=(parts[1]||'').replace(/^@/,'');
    const role = from?.id ? await getRole(from.id) : 'none';
    const ok = roleRank[role] >= roleRank.helper;
    const isDeveloper = role === 'developer';
    const adminCommandNames = new Set([...EXTRA_ADMIN_COMMANDS.map(x=>x.command), 'adminhelp','helpadmin','queue','users','пользователи','bans','баны','user','юзер','ban','бан','unban','разбан','delete','удалить','пароли','resetadminpass','часовойпояс','пароль']);
    if(m && cmd.startsWith('/') && adminCommandNames.has(cmd.slice(1)) && roleRank[role]>=roleRank.helper && !roleCanUseCommand(role,cmd)) { await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:'⛔ Команда недоступна для активной роли «'+({helper:'Помощник',moderator:'Модератор',admin:'Администратор',chief_admin:'Главный администратор',developer:'Разработчик'}[role]||role)+'». Используй /adminhelp для списка доступных команд.'})}); return; }
    if (m && ['/start','/help','/помощь','/admin','/адм'].includes(cmd)) {
      try { await hideTelegramCommands(token); }
      catch (e) { console.error('Telegram chat command menu refresh failed:', e.message); }
    }
    let botLanguage = 'en';
    if(from?.id) {
      try { const langRow=await pool.query("SELECT language FROM users WHERE telegram_id=$1 LIMIT 1",[String(from.id)]); botLanguage=['en','ru','de'].includes(langRow.rows[0]?.language)?langRow.rows[0].language:'en'; } catch {}
    }
    const botWords = {
      ru: {},
      en: {
        'С возвращением':'Welcome back','Добро пожаловать в VIBE':'Welcome to VIBE','Я — помощник VIBE. Можешь не только нажимать кнопки, но и писать мне обычными словами':'I’m the VIBE assistant. You can tap buttons or write to me in your own words',
        'Для начала открой VIBE, создай анкету и добавь интересы. Возрастные стороны разделены: 14–17 лет и 18+.':'To get started, open VIBE, create your profile, and add interests. Teen and adult spaces are separated by age.',
        'Что тебе нужно? Напиши вопрос или выбери действие ниже':'What do you need? Send a question or choose an action below',
        'Я могу помочь с анкетой, чатами, правилами или жалобой. Напиши вопрос обычным сообщением или выбери действие ниже.':'I can help with your profile, chats, rules, or a report. Send a message or choose an action below.',
        '✉️ Напиши одним сообщением, чем тебе нужна помощь. Я передам обращение разработчику, модераторам и помощникам VIBE. Не отправляй пароли, коды входа или лишние личные данные.':'✉️ Please describe how we can help you in a single message. I’ll forward your request to the VIBE developer, moderators, and support team. Don’t share passwords, login codes, or unnecessary personal information.',
        'Открыть VIBE':'Open VIBE','Помощь':'Help','Написать в поддержку':'Contact support','Правила':'Rules','Конфиденциальность':'Privacy',
        'Пожалуйста, выберите язык':'Please choose your language','Язык сохранён.':'Language saved.','Анкета':'Profile','на проверке':'pending review','Твоя анкета VIBE':'Your VIBE profile','прошла проверку и теперь доступна в рекомендациях.':'has been approved and is now visible in recommendations.','не прошла проверку. Пожалуйста, исправьте данные и отправьте анкету повторно.':'was not approved. Please correct the details and submit it again.',
        'Ваш аккаунт забанен':'Your account is banned','Кем заблокирован: ':'Blocked by: ','разработчиком':'the developer','модератором':'a moderator','Причина: ':'Reason: ','Причина не указана':'No reason provided','Доступ к VIBE заблокирован.':'Access to VIBE is blocked.','Доступ к аккаунту ограничен':'Account access is restricted','Анкета удалена':'Profile deleted','Блокировка снята.':'The ban has been lifted.','Пользователь не найден':'User not found','Выбери причину блокировки':'Choose a reason for the ban','Анкета уже обработана.':'This profile has already been reviewed.','Анкета одобрена и опубликована.':'Profile approved and published.','Анкета отклонена.':'Profile rejected.','Пароль сохранён.':'Password saved.','Неверный пароль.':'Incorrect password.','Сначала укажи часовой пояс:':'Set your time zone first:','Часовой пояс сохранён:':'Time zone saved:','Обращение не найдено или закрыто.':'Ticket not found or closed.','Ответ должен содержать от 1 до 3500 символов.':'Your reply must contain 1–3500 characters.','Обращение сохранено, но бот не смог доставить уведомление команде.':'Your ticket was saved, but the bot could not notify the team.','Напиши одним сообщением, почему ты считаешь блокировку ошибочной. Укажи только нужные для рассмотрения сведения; не отправляй пароли или документы.':'Write one message explaining why you believe the ban was a mistake. Include only relevant details; do not send passwords or documents.','Напиши одним сообщением, почему решение по твоей анкете нужно пересмотреть. Не отправляй пароли или документы.':'Write one message explaining why your profile decision should be reviewed. Do not send passwords or documents.','Апелляция должна содержать от 10 до 1500 символов.':'An appeal must contain 10–1500 characters.','У тебя уже есть открытая апелляция. Дождись решения команды VIBE.':'You already have an open appeal. Please wait for the VIBE team’s decision.','Апелляция №':'Appeal #','сохранена. Команда VIBE рассмотрит её и сообщит результат здесь.':'was saved. The VIBE team will review it and reply here.','Ожидай ответа здесь в Telegram.':'Wait for a reply here in Telegram.','Апелляция VIBE':'VIBE appeal','Апелляция одобрена.':'Appeal approved.','Апелляция отклонена.':'Appeal rejected.','✍️ Напиши ответ для обращения #':'✍️ Write a reply to ticket #','Следующее текстовое сообщение будет отправлено пользователю.':'Your next text message will be sent to the user.','Ответ отправлен пользователю по обращению #':'Reply sent to the user for ticket #','✅ Обращение №':'✅ Ticket #','сохранено и передано команде VIBE. Ожидай ответа здесь в Telegram.':'was saved and forwarded to the VIBE team. Wait for a reply here in Telegram.','Обращение сохранено, но бот не смог доставить уведомление команде.':'Your ticket was saved, but the bot could not notify the team.'
      },
      de: {
        'С возвращением':'Willkommen zurück','Добро пожаловать в VIBE':'Willkommen bei VIBE','Я — помощник VIBE. Можешь не только нажимать кнопки, но и писать мне обычными словами':'Ich bin der VIBE-Assistent. Du kannst Schaltflächen antippen oder mir ganz normal schreiben',
        'Для начала открой VIBE, создай анкету и добавь интересы. Возрастные стороны разделены: 14–17 лет и 18+.':'Öffne zuerst VIBE, erstelle dein Profil und füge Interessen hinzu. Jugend- und Erwachsenenbereiche sind nach Alter getrennt.',
        'Что тебе нужно? Напиши вопрос или выбери действие ниже':'Was brauchst du? Schreib eine Frage oder wähle unten eine Aktion',
        'Я могу помочь с анкетой, чатами, правилами или жалобой. Напиши вопрос обычным сообщением или выбери действие ниже.':'Ich helfe dir mit deinem Profil, Chats, Regeln oder einer Meldung. Schreib mir oder wähle unten eine Aktion.',
        'Открыть VIBE':'VIBE öffnen','Помощь':'Hilfe','Написать в поддержку':'Support kontaktieren','Правила':'Regeln','Конфиденциальность':'Datenschutz',
        'Пожалуйста, выберите язык':'Bitte wähle deine Sprache','Язык сохранён.':'Sprache gespeichert.','Анкета':'Profil','на проверке':'wird geprüft','Твоя анкета VIBE':'Dein VIBE-Profil','прошла проверку и теперь доступна в рекомендациях.':'wurde freigegeben und ist jetzt in den Empfehlungen sichtbar.','не прошла проверку. Пожалуйста, исправьте данные и отправьте анкету повторно.':'wurde nicht freigegeben. Bitte korrigiere die Angaben und reiche es erneut ein.',
        'Ваш аккаунт забанен':'Dein Konto ist gesperrt','Кем заблокирован: ':'Gesperrt von: ','разработчиком':'dem Entwickler','модератором':'einem Moderator','Причина: ':'Grund: ','Причина не указана':'Kein Grund angegeben','Доступ к VIBE заблокирован.':'Der Zugang zu VIBE ist gesperrt.','Доступ к аккаунту ограничен':'Der Kontozugriff ist eingeschränkt','Анкета удалена':'Profil gelöscht','Блокировка снята.':'Die Sperre wurde aufgehoben.','Пользователь не найден':'Benutzer nicht gefunden','Выбери причину блокировки':'Wähle einen Sperrgrund','Анкета уже обработана.':'Dieses Profil wurde bereits geprüft.','Анкета одобрена и опубликована.':'Profil genehmigt und veröffentlicht.','Анкета отклонена.':'Profil abgelehnt.','Пароль сохранён.':'Passwort gespeichert.','Неверный пароль.':'Falsches Passwort.','Сначала укажи часовой пояс:':'Lege zuerst deine Zeitzone fest:','Часовой пояс сохранён:':'Zeitzone gespeichert:','Обращение не найдено или закрыто.':'Anfrage nicht gefunden oder geschlossen.','Ответ должен содержать от 1 до 3500 символов.':'Deine Antwort muss 1–3500 Zeichen enthalten.','Напиши одним сообщением, почему ты считаешь блокировку ошибочной. Укажи только нужные для рассмотрения сведения; не отправляй пароли или документы.':'Schreibe in einer Nachricht, warum du die Sperre für falsch hältst. Nenne nur relevante Angaben und sende keine Passwörter oder Dokumente.','Напиши одним сообщением, почему решение по твоей анкете нужно пересмотреть. Не отправляй пароли или документы.':'Schreibe in einer Nachricht, warum die Entscheidung zu deinem Profil überprüft werden sollte. Sende keine Passwörter oder Dokumente.','Апелляция должна содержать от 10 до 1500 символов.':'Ein Einspruch muss 10–1500 Zeichen enthalten.','У тебя уже есть открытая апелляция. Дождись решения команды VIBE.':'Du hast bereits einen offenen Einspruch. Bitte warte auf die Entscheidung des VIBE-Teams.','Апелляция №':'Einspruch #','сохранена. Команда VIBE рассмотрит её и сообщит результат здесь.':'wurde gespeichert. Das VIBE-Team prüft sie und antwortet hier.','Ожидай ответа здесь в Telegram.':'Warte hier in Telegram auf eine Antwort.','✍️ Напиши ответ для обращения #':'✍️ Schreibe eine Antwort auf Anfrage #','Следующее текстовое сообщение будет отправлено пользователю.':'Deine nächste Textnachricht wird an den Nutzer gesendet.','Ответ отправлен пользователю по обращению #':'Antwort wurde an den Nutzer für Anfrage # gesendet','✅ Обращение №':'✅ Anfrage #','сохранено и передано команде VIBE. Ожидай ответа здесь в Telegram.':'wurde gespeichert und an das VIBE-Team weitergeleitet. Warte hier in Telegram auf eine Antwort.','Обращение сохранено, но бот не смог доставить уведомление команде.':'Deine Anfrage wurde gespeichert, aber der Bot konnte das Team nicht benachrichtigen.'
      }
    };
    const translateBot = value => {
      if(botLanguage==='ru') return value;
      let out=value;
      for(const [fromText,toText] of Object.entries(botWords[botLanguage]||{}).sort((a,b)=>b[0].length-a[0].length)) out=out.split(fromText).join(toText);
      return out;
    };
    const translateMarkup = value => { if (Array.isArray(value)) return value.map(translateMarkup); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, key === 'text' && typeof item === 'string' ? translateBot(item) : translateMarkup(item)])); return value; };
    const send=async(text,markup)=>fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:translateBot(text),...(markup?{reply_markup:translateMarkup(markup)}:{})})});
    const staffTelegramIds=async()=>{const q=await pool.query("SELECT telegram_id FROM admin_roles WHERE role IN ('helper','moderator','admin','chief_admin')");return [...new Set([DEVELOPER_TELEGRAM_ID,...(process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean),...q.rows.map(x=>String(x.telegram_id))])];};
    const edit=async(text,markup)=>fetch('https://api.telegram.org/bot'+token+'/editMessageText',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,message_id:cb.message.message_id,text:translateBot(text),...(markup?{reply_markup:translateMarkup(markup)}:{})})});
    const answer=async(text='')=>fetch('https://api.telegram.org/bot'+token+'/answerCallbackQuery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({callback_query_id:cb.id,text})});
    if(cb?.data?.startsWith('lang:set:')) {
      const chosen=cb.data.split(':')[2];
      if(['en','ru','de'].includes(chosen) && from?.id) {
        await pool.query("INSERT INTO users(telegram_id,username,first_name,language) VALUES($1,$2,$3,$4) ON CONFLICT(telegram_id) DO UPDATE SET language=EXCLUDED.language,updated_at=NOW()",[String(from.id),from.username||null,from.first_name||'User',chosen]);
        await answer(chosen==='ru'?'Язык сохранён':chosen==='de'?'Sprache gespeichert':'Language saved');
        const greetings={
          en:'✨ Welcome to VIBE! 💜\n\nI’m your VIBE assistant. I can help with your profile, likes, chats, community rules, and reports.\n\nTeen users (14–17) and verified adults (18+) are kept in separate spaces.\n\nOpen VIBE to get started, or message me anytime if you need help.',
          de:'✨ Willkommen bei VIBE! 💜\n\nIch bin dein VIBE-Assistent. Ich helfe dir mit deinem Profil, Likes, Chats, den Community-Regeln und Meldungen.\n\nJugendliche (14–17) und verifizierte Erwachsene (18+) nutzen getrennte Bereiche.\n\nÖffne VIBE, um loszulegen, oder schreibe mir, wenn du Hilfe brauchst.',
          ru:'✨ Добро пожаловать в VIBE! 💜\n\nЯ — помощник VIBE. Я помогу с анкетой, лайками, чатами, правилами и жалобами.\n\nПодростки 14–17 лет и взрослые 18+ с подтверждённым возрастом находятся в разных разделах.\n\nОткрой VIBE, чтобы начать, или напиши мне, если понадобится помощь.'
        };
        const labels={en:['💜 Open VIBE','❓ Help','✉️ Support','📜 Rules','🔒 Privacy'],de:['💜 VIBE öffnen','❓ Hilfe','✉️ Support','📜 Regeln','🔒 Datenschutz'],ru:['💜 Открыть VIBE','❓ Помощь','✉️ Поддержка','📜 Правила','🔒 Конфиденциальность']}[chosen];
        await send(greetings[chosen],{inline_keyboard:[[{text:labels[0],web_app:{url:'https://vibe-client-sroc.onrender.com'}}],[{text:labels[1],callback_data:'help:main'},{text:labels[2],callback_data:'support:new'}],[{text:labels[3],url:'https://vibe-client-sroc.onrender.com/rules'},{text:labels[4],url:'https://vibe-client-sroc.onrender.com/privacy'}]]});
      } else await answer('Unsupported language');
      return;
    }
    const ownAccount=from?.id ? await pool.query('SELECT id,account_status,moderation_note,ban_issuer,profile_review_status,language FROM users WHERE telegram_id=$1 LIMIT 1',[String(from.id)]) : {rowCount:0,rows:[]};
    if(m&&(cmd==='/closeproject'||cmd==='/закрытьпроект')){
      if(!isDeveloper){await send('⛔ Эта команда доступна только разработчику.');return;}
      const reason=parts.slice(1).join(' ').trim();
      if(!reason||reason.length>500){await send('⚠️ ЗАКРЫТИЕ VIBE\n\nУкажи обязательную причину (до 500 символов).\n\nФормат:\n/closeproject Причина закрытия');return;}
      await pool.query("UPDATE service_maintenance SET enabled=TRUE,reason=$1,updated_by=$2,updated_at=NOW() WHERE id=1",[reason,String(from.id)]);
      await send('🔒 VIBE ЗАКРЫТ\n━━━━━━━━━━━━━━━━━━\nПричина: '+reason+'\n\nСайт покажет это сообщение при входе. Разработчик сохранит доступ.\n\nЧтобы открыть проект снова, отправь: /openproject');
      return;
    }
    if(m&&(cmd==='/openproject'||cmd==='/открытьпроект')){
      if(!isDeveloper){await send('⛔ Эта команда доступна только разработчику.');return;}
      await pool.query("UPDATE service_maintenance SET enabled=FALSE,reason='',updated_by=$1,updated_at=NOW() WHERE id=1",[String(from.id)]);
      await send('✅ VIBE снова открыт. Пользователи могут входить на сайт.');
      return;
    }
    if(m && (cmd==='/switchrole'||cmd==='/myrole'||cmd==='/роль')) {
      const id=String(from.id);
      let assigned='none';
      if(id===DEVELOPER_TELEGRAM_ID) assigned='developer';
      else { const aq=await pool.query('SELECT role FROM admin_roles WHERE telegram_id=$1',[id]); if(aq.rowCount) assigned=aq.rows[0].role; else if((process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).includes(id)) assigned='admin'; }
      if(assigned==='none'){await send('⛔ Переключение ролей доступно только участникам команды VIBE.');return;}
      const names={helper:'Помощник',moderator:'Модератор',admin:'Администратор',chief_admin:'Главный администратор',developer:'Разработчик'};
      if(cmd==='/myrole'||cmd==='/роль'){
        await send('🛡 ТВОЯ РОЛЬ VIBE\n━━━━━━━━━━━━━━━━━━\nАктивная роль: '+names[role]+'\nМаксимальная роль: '+names[assigned]+'\n\nПереключить роль: /switchrole helper|moderator|admin|chief_admin|developer\nВернуться к максимальной роли: /switchrole max');
        return;
      }
      const wanted=(parts[1]||'').toLowerCase();
      const aliases={помощник:'helper',помощникa:'helper',helper:'helper',модератор:'moderator',moderator:'moderator',админ:'admin',admin:'admin',главный:'chief_admin',chief_admin:'chief_admin',разработчик:'developer',developer:'developer',max:assigned,максимум:assigned};
      const target=aliases[wanted];
      if(!target||roleRank[target]>roleRank[assigned]){await send('⚠️ Укажи свою роль или роль ниже твоей.\n\n/switchrole helper\n/switchrole moderator\n/switchrole admin\n/switchrole chief_admin\n/switchrole developer\n/switchrole max\n\nПовышать права выше назначенной роли нельзя.');return;}
      await pool.query('INSERT INTO admin_active_roles(telegram_id,role,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(telegram_id) DO UPDATE SET role=EXCLUDED.role,updated_at=NOW()',[id,target]);
      await send('✅ Активная роль изменена.\n\nТеперь ты: '+names[target]+'\nМаксимально назначенная роль: '+names[assigned]+'\n\nКоманды и права обновлены. Для возврата: /switchrole max');
      return;
    }
    if(m&&isDeveloper&&/^\/(пароли|adminpasswords)(?:@\S+)?$/i.test(txt)){
      const q=await pool.query("SELECT telegram_id,username,role FROM admin_roles WHERE role IN ('chief_admin','admin','moderator','helper') ORDER BY role DESC,username NULLS LAST");
      const lines=['🔐 ПАРОЛИ АДМИНОК','Текущие пароли не хранятся в открытом виде. Для забытого пароля можно выпустить новый.',''];
      for(const a of q.rows)lines.push((a.username?'@'+a.username:'Telegram ID '+a.telegram_id)+' — '+a.role+' — /resetadminpass '+a.telegram_id);
      await send(lines.join('\n'));return;
    }
    if(m&&isDeveloper&&cmd==='/resetadminpass'){
      const id=parts[1]||'';if(!/^\d{5,20}$/.test(id)){await send('Формат: /resetadminpass TELEGRAM_ID. Сначала /пароли.');return;}
      const q=await pool.query("SELECT telegram_id,username,role FROM admin_roles WHERE telegram_id=$1 AND role IN ('chief_admin','admin','moderator','helper')",[id]);
      if(!q.rowCount){await send('Администратор не найден.');return;}
      const password=randomBytes(9).toString('base64url'),salt=randomBytes(16).toString('hex');
      await pool.query("INSERT INTO admin_access_passwords(telegram_id,salt,password_hash,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(telegram_id) DO UPDATE SET salt=EXCLUDED.salt,password_hash=EXCLUDED.password_hash,updated_at=NOW()",[id,salt,hashAdminPassword(password,salt)]);
      await pool.query('DELETE FROM admin_access_sessions WHERE telegram_id=$1',[id]);
      await send('🔐 Новый пароль для '+(q.rows[0].username?'@'+q.rows[0].username:'Telegram ID '+id)+' ('+q.rows[0].role+'):\n\n'+password+'\n\nПередай его лично. Повторно показать нельзя — только выпустить новый.');
      await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:id,text:'Для доступа к админ-командам VIBE введи: /вход ВАШ_ПАРОЛЬ. Не пересылай пароль другим.'})});return;
    }
    if(m && roleRank[role]>=roleRank.admin && cmd==='/часовойпояс'){
      const zone=parts[1]||'';
      try { new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(new Date()); }
      catch { await send('Укажи регион IANA, например: /часовойпояс Europe/Moscow или Europe/Berlin.'); return; }
      await pool.query('INSERT INTO admin_access_timezones(telegram_id,time_zone) VALUES($1,$2) ON CONFLICT(telegram_id) DO UPDATE SET time_zone=EXCLUDED.time_zone',[String(from.id),zone]);
      await send('Часовой пояс сохранён: '+zone+'. Теперь задай пароль командой /пароль ТВОЙ_ПАРОЛЬ.'); return;
    }
    if(m && roleRank[role]>=roleRank.admin && cmd==='/пароль'){
      const password=parts[1]||'';
      if(password.length<4||password.length>128){await send('Пароль должен быть длиной от 4 до 128 символов. Формат: /пароль ТВОЙ_ПАРОЛЬ');return;}
      const tz=await pool.query('SELECT time_zone FROM admin_access_timezones WHERE telegram_id=$1',[String(from.id)]);
      if(!tz.rowCount){await send('Сначала укажи часовой пояс: /часовойпояс Europe/Moscow (или другой регион IANA).');return;}
      const salt=randomBytes(16).toString('hex');
      await pool.query('INSERT INTO admin_access_passwords(telegram_id,salt,password_hash,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(telegram_id) DO UPDATE SET salt=EXCLUDED.salt,password_hash=EXCLUDED.password_hash,updated_at=NOW()',[String(from.id),salt,hashAdminPassword(password,salt)]);
      await pool.query('DELETE FROM admin_access_sessions WHERE telegram_id=$1',[String(from.id)]);
      await send('Пароль сохранён. В дальнейшем отправляй только сам пароль обычным сообщением.'); return;
    }
    // Plain-text password login: do not intercept messages while staff are actively writing a support ticket or reply.
    if(m && txt && !txt.startsWith('/') && roleRank[role]>=roleRank.admin){
      const activeSupport=await pool.query('SELECT mode FROM telegram_support_sessions WHERE telegram_id=$1',[String(from.id)]);
      const writingSupport=activeSupport.rowCount && ['new_ticket','staff_reply'].includes(activeSupport.rows[0].mode);
      if(!writingSupport){
        const q=await pool.query('SELECT p.salt,p.password_hash,t.time_zone FROM admin_access_passwords p JOIN admin_access_timezones t ON t.telegram_id=p.telegram_id WHERE p.telegram_id=$1',[String(from.id)]);
        if(q.rowCount && verifyAdminPassword(txt,q.rows[0].salt,q.rows[0].password_hash)){
          await pool.query("INSERT INTO admin_access_sessions(telegram_id,unlocked_until) VALUES($1,(date_trunc('day', NOW() AT TIME ZONE $2) + INTERVAL '1 day') AT TIME ZONE $2) ON CONFLICT(telegram_id) DO UPDATE SET unlocked_until=EXCLUDED.unlocked_until",[String(from.id),q.rows[0].time_zone]);
          await send('Доступ открыт до 00:00 по времени '+q.rows[0].time_zone+'.\\n\\n'+adminCommandHelp(role),adminReplyKeyboard(role));return;
        }
        // If a password is configured, don't pass a failed password attempt into the public help flow.
        if(q.rowCount) return;
      }
    }
    // Keep the old slash login compatible, if an admin still uses it.
    if(m&&roleRank[role]>=roleRank.admin&&/^\/(вход|adminlogin)(?:@\S+)?$/i.test(cmd)){
      const password=parts[1]||'',q=await pool.query('SELECT salt,password_hash FROM admin_access_passwords WHERE telegram_id=$1',[String(from.id)]);
      if(!password||!q.rowCount||!verifyAdminPassword(password,q.rows[0].salt,q.rows[0].password_hash)){await send('⛔ Неверный пароль.');return;}
      await pool.query("INSERT INTO admin_access_sessions(telegram_id,unlocked_until) VALUES($1,(date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') + INTERVAL '1 day') AT TIME ZONE 'Europe/Berlin') ON CONFLICT(telegram_id) DO UPDATE SET unlocked_until=EXCLUDED.unlocked_until",[String(from.id)]);
      await send('✅ Доступ открыт на 8 часов.\n\n'+adminCommandHelp(role),adminReplyKeyboard(role));return;
    }
    if(m&&roleRank[role]>=roleRank.admin&&!isDeveloper&&!/^\/(start|help|помощь|вход|adminlogin|switchrole|myrole|роль)(?:@\S+)?$/i.test(cmd)&&!await isAdminUnlocked(from.id)){await send('🔒 Админ-команды закрыты паролем.');return;}

    if(m && ownAccount.rowCount && String(from.id)!==DEVELOPER_TELEGRAM_ID) {
      const accountBlocked=['banned','restricted','suspended'].includes(ownAccount.rows[0].account_status);
      const profileRestricted=['restricted','flagged','reviewing'].includes(ownAccount.rows[0].profile_review_status);
      if(cmd==='/appeal' && (accountBlocked || profileRestricted)) {
        const appealType=accountBlocked?'account':'profile';
        await pool.query("INSERT INTO moderation_appeal_sessions(telegram_id,user_id,appeal_type) VALUES($1,$2,$3) ON CONFLICT(telegram_id) DO UPDATE SET user_id=EXCLUDED.user_id,appeal_type=EXCLUDED.appeal_type,created_at=NOW()",[String(from.id),ownAccount.rows[0].id,appealType]);
        await send(appealType==='account'?'⚖️ Напиши одним сообщением, почему ты считаешь блокировку ошибочной. Укажи только нужные для рассмотрения сведения; не отправляй пароли или документы.':'⚖️ Напиши одним сообщением, почему решение по твоей анкете нужно пересмотреть. Не отправляй пароли или документы.');
        return;
      }
      if(!txt.startsWith('/')) {
        const pending=await pool.query('SELECT user_id,appeal_type FROM moderation_appeal_sessions WHERE telegram_id=$1',[String(from.id)]);
        if(pending.rowCount) {
          if(txt.trim().length<10 || txt.trim().length>1500) { await send('Апелляция должна содержать от 10 до 1500 символов.'); return; }
          const saved=await pool.query("INSERT INTO moderation_appeals(user_id,appeal_type,message) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id",[pending.rows[0].user_id,pending.rows[0].appeal_type,txt.trim()]);
          await pool.query('DELETE FROM moderation_appeal_sessions WHERE telegram_id=$1',[String(from.id)]);
          if(!saved.rowCount) { await send('У тебя уже есть открытая апелляция. Дождись решения команды VIBE.'); return; }
          const recipients=await staffTelegramIds();
          const note='⚖️ НОВАЯ АПЕЛЛЯЦИЯ VIBE #'+saved.rows[0].id+'\\nТип: '+pending.rows[0].appeal_type+'\\nПользователь ID: '+pending.rows[0].user_id+'\\nПричина: '+txt.trim();
          const delivered=await Promise.all(recipients.map(async staffId=>{try{const response=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:staffId,text:note})});const result=await response.json().catch(()=>({}));return response.ok&&result.ok;}catch{return false;}}));
          if(!delivered.some(Boolean)) console.error('Telegram appeal #'+saved.rows[0].id+' saved but staff notification failed.');
          await send('✅ Апелляция №'+saved.rows[0].id+' сохранена. Команда VIBE рассмотрит её и сообщит результат здесь.');
          return;
        }
      }
    }
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
      const privilegedCallback = prefix==='l' || prefix==='br' || (prefix==='u' && ['ban','unban','profile','account'].includes(act)) || prefix==='role' || prefix==='pubstatus';
      if(privilegedCallback && roleRank[role]>=roleRank.admin && role!=='developer' && !await isAdminUnlocked(from.id)) { await answer('🔒 Сначала разблокируй админ-сессию паролем в боте.'); return; }
      if(prefix==='support') {
        if(act==='new') {
          await pool.query("INSERT INTO telegram_support_sessions(telegram_id,mode,ticket_id,updated_at) VALUES($1,'new_ticket',NULL,NOW()) ON CONFLICT(telegram_id) DO UPDATE SET mode='new_ticket',ticket_id=NULL,updated_at=NOW()",[String(from.id)]);
          await answer();
          await send('✉️ Напиши одним сообщением, чем тебе нужна помощь. Я передам обращение разработчику, модераторам и помощникам VIBE. Не отправляй пароли, коды входа или лишние личные данные.');
          return;
        }
        if(act==='reply') {
          if(!ok && role!=='moderator' && role!=='helper') {await answer('Отвечать на обращения может только команда VIBE.');return;}
          const ticketId=Number(idRaw);
          const t=await pool.query("SELECT id,status,telegram_id FROM telegram_support_tickets WHERE id=$1",[ticketId]);
          if(!t.rowCount || t.rows[0].status==='closed'){await answer('Обращение не найдено или закрыто.');return;}
          await pool.query("INSERT INTO telegram_support_sessions(telegram_id,mode,ticket_id,updated_at) VALUES($1,'staff_reply',$2,NOW()) ON CONFLICT(telegram_id) DO UPDATE SET mode='staff_reply',ticket_id=$2,updated_at=NOW()",[String(from.id),ticketId]);
          await answer();
          await send('✍️ Напиши ответ для обращения #'+ticketId+'. Следующее текстовое сообщение будет отправлено пользователю.');
          return;
        }
      }
      if(prefix==='help') {
        await answer();
        const helpText=botLanguage==='de'?'💜 VIBE-ASSISTENT\n\nIch helfe dir mit deinem Profil, Likes, Chats, den Regeln und Meldungen an das Moderationsteam.\n\nSchreib deine Frage einfach als normale Nachricht, zum Beispiel: „Ich kann mich nicht anmelden“, „Wie lösche ich mein Profil?“ oder „Ich möchte einen Verstoß melden.“\n\nAltersgruppen 14–17 und 18+ bleiben getrennt.':botLanguage==='ru'?'💜 ПОМОЩНИК VIBE\n\nЯ могу подсказать, как создать или заполнить анкету, объяснить работу лайков и чатов, помочь с правилами и направить жалобу модераторам.\n\nПросто напиши вопрос обычным сообщением — например: «не могу войти», «как удалить анкету» или «хочу сообщить о нарушении».\n\nВозрастные стороны: 14–17 и 18+ разделены.':'💜 VIBE ASSISTANT\n\nI can help you create or complete your profile, explain how likes and chats work, answer questions about the rules, and submit a report to the moderation team.\n\nJust type your question as a regular message — for example: “I can’t log in,” “How do I delete my profile?” or “I want to report a violation.”\n\nAge groups: users aged 14–17 and 18+ are kept separate.';
        await send(helpText,{inline_keyboard:[[{text:'💜 Открыть VIBE',web_app:{url:'https://vibe-client-sroc.onrender.com'}}],[{text:'✉️ Написать в поддержку',callback_data:'support:new'}],[{text:'📜 Правила',url:'https://vibe-client-sroc.onrender.com/rules'},{text:'🔒 Конфиденциальность',url:'https://vibe-client-sroc.onrender.com/privacy'}]]});
        return;
      }
      if(prefix==='l') {
        const actorRole=await getRole(String(from.id));
        if((roleRank[actorRole]??0)<roleRank.moderator){await answer('Проверять и публиковать анкеты может только модератор или роль выше.');return;}
        if(!Number.isSafeInteger(id)||id<=0||!['approve','reject'].includes(act)){await answer('Некорректное действие');return;}
        const found=await pool.query('SELECT l.id,l.user_id,l.name,l.status,u.telegram_id FROM listings l JOIN users u ON u.id=l.user_id WHERE l.id=$1',[id]);
        if(!found.rowCount){await answer('Анкета не найдена');await edit('Анкета уже удалена или не найдена.');return;}
        if(found.rows[0].status!=='pending'){await answer('Эта анкета уже обработана.');await edit('ℹ️ Решение по анкете #'+id+' уже принято: '+found.rows[0].status+'.');return;}
        const status=act==='approve'?'published':'rejected';
        const updated=await pool.query("UPDATE listings SET status=$1,updated_at=NOW() WHERE id=$2 AND status='pending' RETURNING id",[status,id]);
        if(!updated.rowCount){await answer('Анкета уже обработана другим модератором.');return;}
        await logModerationAction({actorId:from.id,actorRole,action:act==='approve'?'listing_approved':'listing_rejected',targetUserId:found.rows[0].user_id,listingId:id,reason:act==='reject'?'Rejected by moderator':'Approved by moderator'});
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
        await logModerationAction({actorId:from.id,actorRole:'developer',action:act==='none'?'staff_role_removed':'staff_role_assigned',targetUserId:id,reason:act==='none'?'Administrative role removed':'Administrative role assigned: '+act});
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
        if((roleRank[actorRole]??0)<roleRank.moderator){await answer('Блокировать аккаунты может только модератор или роль выше.');return;}
        if(!await ensureTargetBelowActor(String(target.rows[0].telegram_id),actorRole)){await answer('Нельзя банить пользователя с равным или более высоким назначенным рангом');return;}
        await pool.query("UPDATE users SET account_status='banned',discoverable=FALSE,moderation_note=$1,ban_issuer=$2,updated_at=NOW() WHERE id=$3",[selected.reason,actorRole==='developer'?'developer':'moderator',targetId]);
        await logModerationAction({actorId:from.id,actorRole,action:'account_banned',targetUserId:targetId,reason:selected.reason});
        await answer('Аккаунт заблокирован: '+selected.label);
        await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:target.rows[0].telegram_id,text:'⛔ Ваш аккаунт забанен.\nКем заблокирован: '+(actorRole==='developer'?'разработчиком':'модератором')+'.\nПричина: '+selected.reason+'\nДоступ к VIBE заблокирован.'})}).catch(e=>console.error('Ban notice failed:',e.message));
        await edit('⛔ АККАУНТ ЗАБЛОКИРОВАН\nПользователь: '+target.rows[0].first_name+' (код '+String(targetId).padStart(6,'0')+')\nКем: '+(actorRole==='developer'?'разработчиком':'модератором')+'\nПричина: '+selected.reason);
        return;
      }
      if(!ok){await answer('Доступ разрешён только администраторам.');return;}
      if(prefix!=='u'||!Number.isSafeInteger(id)||id<=0||!['check','ban','unban','profile','account'].includes(act)){await answer('Некорректное действие');return;}
      const q=await pool.query('SELECT first_name,username,telegram_id,account_status FROM users WHERE id=$1',[id]);
      if(!q.rowCount){await answer('Пользователь не найден');await edit('Пользователь не найден или удалён.');return;}
      if(act==='check'){await answer();await card(id,true);return;}
      if(String(q.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID&&['ban','unban','profile','account'].includes(act)){
        const actionLabel={ban:'Бан разработчика',unban:'Изменение статуса разработчика',profile:'Удаление анкеты разработчика',account:'Удаление аккаунта разработчика'}[act];
        await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:actionLabel,source:'Telegram-кнопка модерации'});
        await answer('Действие запрещено: аккаунт разработчика защищён системой безопасности VIBE.');
        await send('⛔ Разработчика нельзя банить, ограничивать или удалять.');
        return;
      }
      const actorRole=await getRole(String(from.id));
      const requiredRole=act==='account'?'admin':(['ban','unban','profile'].includes(act)?'moderator':null);
      if(requiredRole && (roleRank[actorRole]??0)<roleRank[requiredRole]){
        await answer('Для этого действия нужна роль «'+({moderator:'Модератор',admin:'Администратор'}[requiredRole])+'» или выше.');
        return;
      }
      if(['unban','profile','account'].includes(act) && !await ensureTargetBelowActor(String(q.rows[0].telegram_id),actorRole)){
        if(String(q.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID)await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:({unban:'Изменение блокировки разработчика',profile:'Удаление анкеты разработчика',account:'Удаление аккаунта разработчика'})[act],source:'Telegram-кнопка модерации'});
        await answer('Нельзя изменять аккаунт сотрудника с равной или более высокой ролью.');
        return;
      }
      if(act==='ban'){const reasonsKeyboard={inline_keyboard:Object.entries(BAN_REASONS).map(([key,item])=>[{text:item.label,callback_data:'br:'+id+':'+key}])};await answer('Выбери причину бана');await send('⛔ Выберите причину блокировки для '+q.rows[0].first_name+'. После нажатия аккаунт будет заблокирован, а выбранная причина сохранится в системе.',reasonsKeyboard);return;}
      if(act==='unban'){if(q.rows[0].account_status!=='banned'){await answer('Аккаунт не заблокирован. Другие ограничения этой кнопкой не снимаются.');return;}const restored=await pool.query("UPDATE users SET account_status='active',discoverable=TRUE,moderation_note=NULL,updated_at=NOW() WHERE id=$1 AND account_status='banned' RETURNING id",[id]);if(!restored.rowCount){await answer('Аккаунт уже не заблокирован.');return;}await answer('Блокировка снята.');await edit('✅ Бан снят.');return;}
      if(act==='profile'){await pool.query("UPDATE users SET bio='',city=NULL,photo_url=NULL,gender=NULL,goal='friendship',interests='{}',discoverable=FALSE,profile_review_status='restricted',moderation_note='Profile deleted by Telegram admin',updated_at=NOW() WHERE id=$1",[id]);await logModerationAction({actorId:from.id,actorRole,action:'profile_removed',targetUserId:id,reason:'Profile removed by Telegram moderator'});await answer('Анкета удалена');await edit('🧹 Анкета удалена. Аккаунт сохранён.');return;}
      if(act==='account'){await logModerationAction({actorId:from.id,actorRole,action:'account_deleted',targetUserId:id,reason:'Account deleted by Telegram moderator'});await pool.query('DELETE FROM users WHERE id=$1',[id]);await answer('Учётная запись удалена.');await edit('🗑 Аккаунт удалён вместе с анкетой, лайками, чатами и жалобами. Пользователь сможет зарегистрироваться снова с тем же Telegram-аккаунтом.');return;}
    }
    if(!m)return;
    let reply,markup;
    const session=from?.id?await pool.query('SELECT mode,ticket_id FROM telegram_support_sessions WHERE telegram_id=$1',[String(from.id)]):{rowCount:0,rows:[]};
    if(session.rowCount && session.rows[0].mode==='staff_reply' && (ok || role==='moderator' || role==='helper') && !txt.startsWith('/')) {
      const ticketId=Number(session.rows[0].ticket_id);
      if(!txt || txt.length>3500){await send('Ответ должен содержать от 1 до 3500 символов.');return;}
      const t=await pool.query("SELECT id,telegram_id,first_name,status FROM telegram_support_tickets WHERE id=$1",[ticketId]);
      if(!t.rowCount || t.rows[0].status==='closed'){await pool.query('DELETE FROM telegram_support_sessions WHERE telegram_id=$1',[String(from.id)]);await send('Обращение не найдено или уже закрыто.');return;}
      await pool.query("INSERT INTO telegram_support_messages(ticket_id,sender_telegram_id,sender_role,message) VALUES($1,$2,$3,$4)",[ticketId,String(from.id),role,txt]);
      await pool.query("UPDATE telegram_support_tickets SET status='answered',updated_at=NOW() WHERE id=$1",[ticketId]);
      await pool.query('DELETE FROM telegram_support_sessions WHERE telegram_id=$1',[String(from.id)]);
      await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:t.rows[0].telegram_id,text:'💜 Ответ команды VIBE по обращению #'+ticketId+':\n\n'+txt})});
      await send('✅ Ответ отправлен пользователю по обращению #'+ticketId+'.');
      return;
    }
    if(session.rowCount && session.rows[0].mode==='new_ticket' && !txt.startsWith('/')) {
      if(!txt || txt.length>3500){await send('Опиши проблему сообщением до 3500 символов.');return;}
      const linked=await pool.query('SELECT id,first_name,username FROM users WHERE telegram_id=$1 LIMIT 1',[String(from.id)]);
      const t=await pool.query("INSERT INTO telegram_support_tickets(telegram_id,username,first_name,user_id,message,status) VALUES($1,$2,$3,$4,$5,'open') RETURNING id",[String(from.id),from.username||null,from.first_name||'Пользователь',linked.rows[0]?.id||null,txt]);
      const ticketId=t.rows[0].id;
      await pool.query("INSERT INTO telegram_support_messages(ticket_id,sender_telegram_id,sender_role,message) VALUES($1,$2,'user',$3)",[ticketId,String(from.id),txt]);
      const staffIds=await staffTelegramIds();
      const note='🆘 НОВОЕ ОБРАЩЕНИЕ VIBE #'+ticketId+'\nОт: '+(from.first_name||'Пользователь')+(from.username?' (@'+from.username+')':'')+'\nTelegram ID: '+from.id+'\n\n'+txt+'\n\nНажми «Ответить», чтобы написать пользователю.';
      const deliveryResults=await Promise.all(staffIds.map(async staffId=>{try{const response=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:staffId,text:note,reply_markup:{inline_keyboard:[[{text:'✍️ Ответить',callback_data:'support:reply:'+ticketId}]]}})});const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)console.error('Support ticket notify rejected:',staffId,result.description||response.status);return response.ok&&result.ok;}catch(e){console.error('Support ticket notify failed:',staffId,e.message);return false;}}));
      await pool.query('DELETE FROM telegram_support_sessions WHERE telegram_id=$1',[String(from.id)]);
      if(!deliveryResults.some(Boolean)){
        await pool.query("UPDATE telegram_support_tickets SET status='open',updated_at=NOW() WHERE id=$1",[ticketId]);
        await send('⚠️ Обращение №'+ticketId+' сохранено, но бот не смог доставить уведомление команде. Попробуй позже или напиши /support.');
        return;
      }
      await send('✅ Обращение №'+ticketId+' сохранено и передано команде VIBE. Ожидай ответа здесь в Telegram.');
      return;
    }
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
      let needsLanguage = true;
      let firstName = (from?.first_name || '').trim();
      if(from?.id&&from?.first_name) {
        const existing = await pool.query('SELECT language FROM users WHERE telegram_id=$1 LIMIT 1',[String(from.id)]);
        firstVisit = existing.rowCount === 0;
        needsLanguage = firstVisit || !existing.rows[0]?.language;
        const u=await pool.query('INSERT INTO users(telegram_id,username,first_name) VALUES($1,$2,$3) ON CONFLICT(telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,updated_at=NOW() RETURNING id,account_status,moderation_note',[String(from.id),from.username??null,from.first_name]);
        const referralMatch = /^ref_(\d{6})$/.exec(parts[1] || '');
        if (firstVisit && referralMatch) {
          const referrer = await pool.query("SELECT id FROM users WHERE lpad(id::text,6,'0')=$1 AND account_status='active'", [referralMatch[1]]);
          if (referrer.rowCount && Number(referrer.rows[0].id) !== Number(u.rows[0]?.id)) {
            await pool.query('INSERT INTO referrals(referrer_user_id,referred_user_id,referred_telegram_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [referrer.rows[0].id, u.rows[0].id, String(from.id)]);
          }
        }
        if (u.rows[0]?.account_status === 'banned') {
          reply='⛔ Ваша учётная запись VIBE заблокирована.\nПричина: '+(u.rows[0].moderation_note||'Причина не указана')+'\nДоступ к сайту и функциям аккаунта закрыт.';
          await send(reply); return;
        }
        if (['suspended','restricted'].includes(u.rows[0]?.account_status)) {
          reply='⚠️ Доступ к вашей учётной записи VIBE ограничен.\nПричина: '+(u.rows[0].moderation_note||'Причина не указана');
          await send(reply); return;
        }
      }
      if (needsLanguage) {
        reply='✨ Welcome to VIBE! Please choose your language:';
        markup={inline_keyboard:[[{text:'🇬🇧 English',callback_data:'lang:set:en'},{text:'🇩🇪 Deutsch',callback_data:'lang:set:de'},{text:'🇷🇺 Русский',callback_data:'lang:set:ru'}]]};
      } else {
        reply='С возвращением'+(firstName ? ', '+firstName : '')+'! 💜\n\nЯ могу помочь с анкетой, чатами, правилами или жалобой. Напиши вопрос обычным сообщением или выбери действие ниже.';
        markup={inline_keyboard:[[{text:'💜 Открыть VIBE',web_app:{url:'https://vibe-client-sroc.onrender.com'}}],[{text:'❓ Помощь',callback_data:'help:main'},{text:'✉️ Написать в поддержку',callback_data:'support:new'}],[{text:'🛡 Правила',url:'https://vibe-client-sroc.onrender.com/rules'}],[{text:'🔒 Конфиденциальность',url:'https://vibe-client-sroc.onrender.com/privacy'}]]};
      }
    }else if(cmd==='/адм'||cmd==='/admin'){
      const adminAllowed=(roleRank[role]??0)>=roleRank.admin && (isDeveloper || await isAdminUnlocked(from.id));
      reply=adminAllowed?'🛡 VIBE | ADMIN PANEL\nYour role: '+(role==='developer'?'Developer':ROLE_LABELS[role])+'\nChoose an action from the keyboard below.':'🔒 Админ-меню недоступно. Проверь назначенную роль и введи пароль ещё раз.';
      if(adminAllowed)markup=adminReplyKeyboard(role);
     }else if(cmd==='/бан'||cmd==='/ban'){
      if(!ok || (roleRank[role]??0)<roleRank.moderator){
        reply='⛔ Для блокировки нужен ранг модератора или выше.';
      } else {
        const bm=txt.match(/^\/(?:бан|ban)(?:@\S+)?\s+(@?[A-Za-z0-9_]{5,32}|\d{6})$/i);
        if(!bm){
          reply='Формат: /ban @username или /ban 001234. Затем выбери причину из списка.';
        } else {
          const key=bm[1].replace(/^@/,'');
          const found=await pool.query("SELECT id,first_name,username,telegram_id FROM users WHERE lower(username)=lower($1) OR (lpad(id::text,6,'0')=$1 AND $1 ~ '^[0-9]{6}$')",[key]);
          if(found.rowCount && String(found.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){
            await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:'Бан разработчика (команда /ban)',source:'Telegram-команда'});
            reply='⛔ Действие запрещено: аккаунт разработчика защищён системой безопасности VIBE.';
          } else if(!found.rowCount){
            reply='Пользователь не найден.';
          } else if(!(await ensureTargetBelowActor(String(found.rows[0].telegram_id),role))){
            reply='⛔ Нельзя банить пользователя с равным или более высоким рангом.';
          } else {
            reply='Выбери причину блокировки для '+found.rows[0].first_name+'.';
            markup={inline_keyboard:Object.entries(BAN_REASONS).map(([reasonKey,item])=>[{text:item.label,callback_data:'br:'+found.rows[0].id+':'+reasonKey}])};
          }
        }
      }
    }else if(cmd==='/разбан'||cmd==='/unban'){
      if(!ok || (roleRank[role]??0)<roleRank.moderator)reply='⛔ Для снятия блокировки нужен ранг модератора или выше.';
      else if(!/^(@?[A-Za-z0-9_]{5,32}|\d{6})$/.test(arg))reply='Формат: /разбан @username или /разбан 001234';
      else{
        const targetKey=arg.replace(/^@/,'');
        const found=await pool.query("SELECT id,first_name,username,telegram_id,account_status FROM users WHERE lower(username)=lower($1) OR (lpad(id::text,6,'0')=$1 AND $1 ~ '^[0-9]{6}$')",[targetKey]);
        if(!found.rowCount)reply='Пользователь не найден. Проверь username или 6-значный код.';
        else if(String(found.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){
          await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:'Изменение статуса разработчика командой /разбан',source:'Telegram-команда'});
          reply='⛔ Статус аккаунта разработчика защищён от изменений.';
        }else if(!(await ensureTargetBelowActor(String(found.rows[0].telegram_id),role))){
          reply='⛔ Нельзя снимать блокировку с пользователя равного или более высокого ранга.';
        }else if(found.rows[0].account_status!=='banned'){
          reply='ℹ️ Этот аккаунт не заблокирован. Ограничения другого типа этой командой не снимаются.';
        }else{
          const target=await pool.query("UPDATE users SET account_status='active',discoverable=TRUE,moderation_note=NULL,updated_at=NOW() WHERE id=$1 AND account_status='banned' RETURNING id,first_name,username",[found.rows[0].id]);
          reply=target.rowCount?'✅ Разбанен: '+target.rows[0].first_name+' (код '+String(target.rows[0].id).padStart(6,'0')+(target.rows[0].username?', @'+target.rows[0].username:'')+').' :'ℹ️ Аккаунт уже не заблокирован.';
        }
      }
    }else if(cmd==='/удалить'||cmd==='/delete'){
      if(!ok || (roleRank[role]??0)<roleRank.admin)reply='⛔ Для удаления аккаунта нужен ранг администратора или выше.';
      else if(!/^(@?[A-Za-z0-9_]{5,32}|\d{6})$/.test(arg))reply='Формат: /удалить @username или /удалить 001234';
      else{
        const key=arg.replace(/^@/,'');
        const found=await pool.query("SELECT id,first_name,username,telegram_id FROM users WHERE lower(username)=lower($1) OR (lpad(id::text,6,'0')=$1 AND $1 ~ '^[0-9]{6}$')",[key]);
        if(found.rowCount&&String(found.rows[0].telegram_id)===DEVELOPER_TELEGRAM_ID){
          await notifyDeveloperAttempt({actorId:from?.id,actorName:from?.first_name,actorUsername:from?.username,action:'Удаление аккаунта разработчика (команда /удалить)',source:'Telegram-команда'});
          reply='⛔ Действие запрещено: аккаунт разработчика защищён системой безопасности VIBE.';
        }else if(!found.rowCount)reply='Пользователь не найден. Проверь username или 6-значный код.';
        else if(!(await ensureTargetBelowActor(String(found.rows[0].telegram_id),role)))reply='⛔ Нельзя удалять аккаунт пользователя равного или более высокого ранга.';
        else{
          const target=await pool.query('DELETE FROM users WHERE id=$1 RETURNING id,first_name,username',[found.rows[0].id]);
          reply=target.rowCount?'🗑 Аккаунт '+target.rows[0].first_name+' (код '+String(target.rows[0].id).padStart(6,'0')+(target.rows[0].username?', @'+target.rows[0].username:'')+') удалён.':'⚠️ Аккаунт не удалось удалить.';
        }
      }
    }else if(cmd==='/юзер'||cmd==='/user'){
      if(!ok)reply='⛔ Доступ разрешён только администраторам.';
      else if(!arg)reply='Формат: /юзер @username, /юзер 001234 или /юзер Telegram_ID';
      else{
        const q=await pool.query("SELECT id FROM users WHERE telegram_id::text=$1 OR lower(username)=lower($1) OR (lpad(id::text,6,'0')=$1 AND $1 ~ '^[0-9]{6}$')",[arg]);
        if(!q.rowCount)reply='Пользователь не найден. Он должен хотя бы один раз открыть бота или приложение VIBE.';
        else{await card(q.rows[0].id);return;}
      }
    }else if(cmd==='/помощь'||cmd==='/help'||cmd==='/support'||cmd==='/helpuser'){
      reply='💜 ПОМОЩЬ ПОЛЬЗОВАТЕЛЮ VIBE\n\nЯ помогу с регистрацией и анкетой, фото и интересами, рекомендациями, лайками, чатами, входом, правилами, безопасностью и удалением данных.\n\nНапиши проблему своими словами — например:\n• «Не могу войти»\n• «Почему не вижу анкеты?»\n• «Не отправляются сообщения»\n• «Как поставить лайк?»\n• «Что делать при сексуальных домогательствах?»\n• «Хочу пожаловаться на профиль»\n• «Как удалить анкету?»\n\nЕсли не смогу решить вопрос, нажми «Связаться с поддержкой» — обращение получит команда VIBE. Не отправляй пароли и коды входа.';
      markup={inline_keyboard:[[{text:'💜 Открыть VIBE',web_app:{url:'https://vibe-client-sroc.onrender.com'}}],[{text:'✉️ Связаться с поддержкой',callback_data:'support:new'}],[{text:'📜 Правила',url:'https://vibe-client-sroc.onrender.com/rules'},{text:'🔒 Конфиденциальность',url:'https://vibe-client-sroc.onrender.com/privacy'}]]};
    }else if(cmd==='/adminhelp'||cmd==='/helpadmin'){
      if(!ok){reply='⛔ Эта справка доступна только администраторам и команде VIBE.';markup=undefined;}
      else{reply=adminCommandHelp(role);markup={remove_keyboard:true};}
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
    }else{
      const lower=txt.toLocaleLowerCase('ru');
      if(/^(привет|здравствуй|здравствуйте|хай|hello|hi|добрый день|добрый вечер)\b/.test(lower)) {
        reply='Привет! 💜 Я помощник VIBE. Могу помочь с анкетой, доступом, чатами, правилами или жалобой. Что случилось? Напиши своими словами.';
      } else if(/сексуал|домог|насиль|изнасил|непристойн|пристав|трогал|трогала|трогали|принужд|эксплуатац/.test(lower)) {
        reply='🛡 Мне жаль, что это произошло. Сексуальные домогательства на VIBE — серьёзное нарушение.\n\nЧто можно сделать сейчас:\n1. Если ты в непосредственной опасности, уйди в безопасное место и обратись в местную экстренную службу или к взрослому, которому доверяешь.\n2. Не отвечай нарушителю, если это небезопасно; заблокируй его, если такая функция доступна.\n3. Сохрани доказательства: сообщения, имя/код профиля, дату и ссылки. Не публикуй интимные изображения и не пересылай их другим.\n4. Отправь официальную жалобу через профиль пользователя или публикацию в VIBE и выбери наиболее подходящую причину.\n5. Если жалоба не отправляется или нужна помощь команды, нажми «Связаться с поддержкой» ниже.\n\nНе нужно описывать подробности сексуального характера. Не отправляй пароли, адрес или другие лишние личные данные.';
        markup={inline_keyboard:[[{text:'🛡 Открыть VIBE для жалобы',web_app:{url:'https://vibe-client-sroc.onrender.com'}}],[{text:'✉️ Связаться с поддержкой',callback_data:'support:new'}],[{text:'📜 Правила',url:'https://vibe-client-sroc.onrender.com/rules'}]]};
      } else if(/жалоб|пожалова|репорт|нарушен|оскорб|угрожа|шантаж|преслед|фейк|мошенн|обман|опасн|издева|спам/.test(lower)) {
        reply='🛡 Я помогу с обращением по безопасности. Опиши в общих словах, что произошло, и укажи код профиля нарушителя, если он известен. Не присылай пароли, документы, адрес или другие лишние личные данные.\n\nЧтобы отправить официальную жалобу, открой VIBE и воспользуйся функцией жалобы в профиле или публикации. Если нужна помощь команды, нажми «Связаться с поддержкой».';
        markup={inline_keyboard:[[{text:'🛡 Открыть VIBE для жалобы',web_app:{url:'https://vibe-client-sroc.onrender.com'}}],[{text:'✉️ Связаться с поддержкой',callback_data:'support:new'}],[{text:'📜 Правила',url:'https://vibe-client-sroc.onrender.com/rules'}]]};
      } else if(/анкета|профил|фото|описан|интерес|регистрац|созда(ть|ть)|изменить данные|удалить аккаунт|удалить профиль/.test(lower)) {
        reply='👤 Чтобы создать или изменить анкету, открой VIBE и перейди в свой профиль. Добавь актуальную фотографию, короткое описание и интересы. Не публикуй телефон, адрес и другие чувствительные данные в открытом профиле.';
        markup={inline_keyboard:[[{text:'👤 Открыть профиль VIBE',web_app:{url:'https://vibe-client-sroc.onrender.com'}}]]};
      } else if(/чат|сообщен|написать|личн|лайк|симпат|рекомендац|лента|не вижу|не работает|не могу|ошибк|войти|вход|заблокир|бан|не открывается|не загружается|пусто/.test(lower)) {
        reply='🔧 Давай разберёмся. Проверь, что приложение открывается и анкета заполнена. Доступ к чатам и рекомендациям может зависеть от статуса аккаунта и возрастной стороны (14–17 или 18+). Если проблема осталась, напиши, что именно происходит и какой текст ошибки видишь — не отправляй пароль или коды входа.';
        markup={inline_keyboard:[[{text:'💜 Открыть VIBE',web_app:{url:'https://vibe-client-sroc.onrender.com'}}],[{text:'❓ Помощь',callback_data:'help:main'}]]};
      } else if(/правил|конфиденциал|данн|удалить аккаунт|удалить анкету/.test(lower)) {
        reply='📚 Здесь можно прочитать правила VIBE и политику конфиденциальности. Если хочешь удалить аккаунт или запросить удаление данных, напиши подробнее — подскажу следующий шаг.';
        markup={inline_keyboard:[[{text:'📜 Правила',url:'https://vibe-client-sroc.onrender.com/rules'},{text:'🔒 Конфиденциальность',url:'https://vibe-client-sroc.onrender.com/privacy'}],[{text:'💜 Открыть VIBE',web_app:{url:'https://vibe-client-sroc.onrender.com'}}]]};
      } else {
        reply='Я пока не понял вопрос, но могу помочь 💜\n\nНапиши, что именно нужно: «анкета», «чаты», «вход», «жалоба», «правила» или опиши проблему обычными словами. Команда /help показывает возможности помощника.';
        markup={inline_keyboard:[[{text:'💜 Открыть VIBE',web_app:{url:'https://vibe-client-sroc.onrender.com'}}],[{text:'❓ Помощь',callback_data:'help:main'}],[{text:'📜 Правила',url:'https://vibe-client-sroc.onrender.com/rules'}]]};
      }
    }
    await send(reply,markup);
  })().catch(async e=>{console.error('Telegram webhook processing failed:',e.stack||e.message);try{if(chatId)await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:'⚠️ Не удалось обработать сообщение из-за временной ошибки. Обращение не подтверждено — попробуй отправить его ещё раз или нажми /support.'})});}catch(notifyError){console.error('Telegram webhook error reply failed:',notifyError.message);}});
});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Internal server error'});});
async function start() {
  await initializeDatabase(pool);
  const server = app.listen(port, () => {
    console.log('VIBE API listening on ' + port);
    const token = process.env.BOT_TOKEN;
    if (token) {
      hideTelegramCommands(token).catch(err => console.error('Telegram command menu hiding failed:', err.message));
      fetch('https://api.telegram.org/bot' + token + '/setChatMenuButton', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ menu_button: { type: 'web_app', text: 'Open VIBE', web_app: { url: 'https://vibe-client-sroc.onrender.com' } } }) }).then(r => r.json()).then(result => console.log('Telegram Mini App menu button setup:', result.ok ? 'ok' : result.description)).catch(err => console.error('Telegram Mini App menu button setup failed:', err.message));
      fetch('https://api.telegram.org/bot' + token + '/setWebhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://znakomstva-824i.onrender.com/telegram/webhook', secret_token: TELEGRAM_WEBHOOK_SECRET })
      }).then(r => r.json()).then(result => console.log('Telegram webhook setup:', result.ok ? 'ok' : result.description))
        .catch(err => console.error('Telegram webhook setup failed:', err.message));
    } else {
      console.error('BOT_TOKEN is missing; Telegram bot is disabled');
    }
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('VIBE API received ' + signal + '; shutting down gracefully.');
    server.close(() => {
      pool.end()
        .then(() => { console.log('VIBE database pool closed.'); })
        .catch((err) => { console.error('VIBE database pool shutdown failed:', err.message); process.exitCode = 1; });
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
start().catch((err) => {
  console.error('VIBE startup failed; HTTP server was not started.');
  process.exitCode = 1;
});