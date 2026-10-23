export const EXTRA_ADMIN_COMMANDS = [
  {
    "command": "stats",
    "description": "Показать статистику платформы"
  },
  {
    "command": "today",
    "description": "Новые аккаунты за сегодня"
  },
  {
    "command": "week",
    "description": "Новые аккаунты за неделю"
  },
  {
    "command": "pending",
    "description": "Количество анкет на проверке"
  },
  {
    "command": "published",
    "description": "Количество опубликованных анкет"
  },
  {
    "command": "rejected",
    "description": "Количество отклонённых анкет"
  },
  {
    "command": "reports",
    "description": "Список открытых жалоб"
  },
  {
    "command": "reportstats",
    "description": "Статистика жалоб"
  },
  {
    "command": "flags",
    "description": "Открытые сигналы модерации"
  },
  {
    "command": "flagstats",
    "description": "Статистика сигналов модерации"
  },
  {
    "command": "recent",
    "description": "Недавно зарегистрированные пользователи"
  },
  {
    "command": "inactive",
    "description": "Неактивные более 30 дней аккаунты"
  },
  {
    "command": "search",
    "description": "Поиск по имени или username"
  },
  {
    "command": "bycity",
    "description": "Количество анкет по городу"
  },
  {
    "command": "topcities",
    "description": "Популярные города в анкетах"
  },
  {
    "command": "interests",
    "description": "Популярные интересы пользователей"
  },
  {
    "command": "likes",
    "description": "Количество лайков и взаимных симпатий"
  },
  {
    "command": "matches",
    "description": "Количество взаимных симпатий"
  },
  {
    "command": "chats",
    "description": "Количество активных переписок"
  },
  {
    "command": "messages",
    "description": "Количество сообщений"
  },
  {
    "command": "profiles",
    "description": "Статистика анкет"
  },
  {
    "command": "verified",
    "description": "Количество подтверждённых совершеннолетних"
  },
  {
    "command": "unverified",
    "description": "Ожидают подтверждения возраста"
  },
  {
    "command": "agequeue",
    "description": "Очередь проверки возраста"
  },
  {
    "command": "staff",
    "description": "Список ролей команды"
  },
  {
    "command": "admins",
    "description": "Список администраторов"
  },
  {
    "command": "moderators",
    "description": "Список модераторов"
  },
  {
    "command": "helpers",
    "description": "Список помощников"
  },
  {
    "command": "rolecheck",
    "description": "Проверить роль пользователя"
  },
  {
    "command": "permissions",
    "description": "Показать ваши права доступа"
  },
  {
    "command": "statuslist",
    "description": "Статистика публичных статусов"
  },
  {
    "command": "review",
    "description": "Взять жалобу или сигнал на проверку"
  },
  {
    "command": "resolve",
    "description": "Закрыть жалобу или сигнал по ID"
  },
  {
    "command": "dismiss",
    "description": "Отклонить жалобу или сигнал по ID"
  },
  {
    "command": "approve",
    "description": "Одобрить анкету по ID"
  },
  {
    "command": "reject",
    "description": "Отклонить анкету по ID"
  },
  {
    "command": "hide",
    "description": "Скрыть опубликованную анкету по ID"
  },
  {
    "command": "show",
    "description": "Опубликовать одобренную анкету по ID"
  },
  {
    "command": "restrict",
    "description": "Ограничить аккаунт пользователя"
  },
  {
    "command": "suspend",
    "description": "Приостановить аккаунт пользователя"
  },
  {
    "command": "restore",
    "description": "Восстановить аккаунт пользователя"
  },
  {
    "command": "health",
    "description": "Проверить состояние сервиса и базы данных"
  },
  {
    "command": "ping",
    "description": "Проверить ответ бота"
  },
  {
    "command": "dbcheck",
    "description": "Проверить подключение к базе VIBE"
  },
  {
    "command": "botinfo",
    "description": "Информация о боте и приложении"
  },
  {
    "command": "myrole",
    "description": "Показать вашу текущую роль"
  },
  {
    "command": "queueall",
    "description": "Сводка по всем очередям модерации"
  },
  {
    "command": "flagqueue",
    "description": "Показать открытые сигналы модерации"
  },
  {
    "command": "reportqueue",
    "description": "Показать открытые жалобы"
  },
  {
    "command": "profilequeue",
    "description": "Показать анкеты на проверке"
  },
  {
    "command": "oldreports",
    "description": "Жалобы старше семи дней"
  },
  {
    "command": "closedreports",
    "description": "Количество закрытых жалоб"
  },
  {
    "command": "banned",
    "description": "Список заблокированных аккаунтов"
  },
  {
    "command": "restricted",
    "description": "Список аккаунтов с ограничениями"
  },
  {
    "command": "suspended",
    "description": "Список приостановленных аккаунтов"
  },
  {
    "command": "blocked",
    "description": "Количество блокировок пользователей"
  },
  {
    "command": "blocks",
    "description": "Статистика блокировок пользователей"
  },
  {
    "command": "likesstats",
    "description": "Подробная статистика лайков"
  },
  {
    "command": "matchstats",
    "description": "Подробная статистика взаимных симпатий"
  },
  {
    "command": "activity",
    "description": "Активность за последние 24 часа"
  }
];

export async function handleExtraAdminCommand({ command, parts, pool, role, developerId, apiUrl, clientUrl }) {
  const fullArg = parts.slice(1).join(' ').trim();
  const key = (parts[1] || '').replace(/^@/, '');
  const numericId = Number(parts[1]);
  const count = async sql => (await pool.query(sql)).rows[0]?.count ?? 0;
  const rows = async (sql, params=[]) => (await pool.query(sql, params)).rows;
  const fmtUsers = list => list.length ? list.map(u => '• ' + (u.first_name || 'User') + (u.username ? ' (@' + u.username + ')' : '') + ' — code ' + String(u.id).padStart(6, '0')).join('\n') : 'No matching accounts found.';
  const setListingStatus = async status => {
    if (!Number.isSafeInteger(numericId) || numericId <= 0) return 'Usage: /' + command + ' LISTING_ID';
    const q = await pool.query('UPDATE listings SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,status', [status, numericId]);
    return q.rowCount ? 'Listing #' + q.rows[0].id + ' (“' + q.rows[0].name + '”) status: ' + q.rows[0].status + '.' : 'Listing not found.';
  };
  const changeUserStatus = async status => {
    if (!key) return 'Usage: /' + command + ' @username or 6-digit account code [reason]';
    const q = await pool.query("SELECT id,telegram_id,first_name,username FROM users WHERE lower(username)=lower($1) OR (lpad(id::text,6,'0')=$1 AND $1 ~ '^[0-9]{6}$') OR telegram_id::text=$1", [key]);
    if (!q.rowCount) return 'User not found.';
    if (String(q.rows[0].telegram_id) === developerId) return '⛔ The developer account is protected.';
    const reason = parts.slice(2).join(' ').trim();
    if (['restricted','suspended'].includes(status) && !reason) return 'Add a reason. Example: /' + command + ' 001234 spam';
    await pool.query('UPDATE users SET account_status=$1,discoverable=CASE WHEN $1=\'active\' THEN TRUE ELSE FALSE END,moderation_note=CASE WHEN $1=\'active\' THEN NULL ELSE $2 END,ban_issuer=CASE WHEN $1=\'banned\' THEN $4 ELSE ban_issuer END,updated_at=NOW() WHERE id=$3', [status, reason || ('Admin action: ' + status), q.rows[0].id, role === 'developer' ? 'developer' : 'moderator']);
    return 'Account ' + String(q.rows[0].id).padStart(6,'0') + ' updated to ' + status + '.';
  };
  switch (command) {
    case 'stats': return 'VIBE | PLATFORM STATISTICS\nAccounts: ' + await count('SELECT COUNT(*)::int AS count FROM users') + '\nListings: ' + await count('SELECT COUNT(*)::int AS count FROM listings') + '\nPublished: ' + await count("SELECT COUNT(*)::int AS count FROM listings WHERE status='published'") + '\nLikes: ' + await count('SELECT COUNT(*)::int AS count FROM likes') + '\nMessages: ' + await count('SELECT COUNT(*)::int AS count FROM messages');
    case 'today': return 'New accounts today: ' + await count('SELECT COUNT(*)::int AS count FROM users WHERE created_at >= CURRENT_DATE');
    case 'week': return 'New accounts in the last 7 days: ' + await count("SELECT COUNT(*)::int AS count FROM users WHERE created_at >= NOW()-INTERVAL '7 days'");
    case 'pending': return 'Pending profile listings: ' + await count("SELECT COUNT(*)::int AS count FROM listings WHERE status='pending'");
    case 'published': return 'Published profile listings: ' + await count("SELECT COUNT(*)::int AS count FROM listings WHERE status='published'");
    case 'rejected': return 'Rejected profile listings: ' + await count("SELECT COUNT(*)::int AS count FROM listings WHERE status='rejected'");
    case 'reports': case 'reportqueue': { const list=await rows("SELECT r.id,r.reason,r.details,r.created_at,u.first_name,u.username FROM reports r JOIN users u ON u.id=r.reported_id WHERE r.status IN ('open','reviewing') ORDER BY r.created_at DESC LIMIT 12"); return list.length?'OPEN REPORTS\n'+list.map(r=>'#'+r.id+' — '+r.first_name+(r.username?' (@'+r.username:'')+'\nReason: '+r.reason+'\n'+String(r.details||'').slice(0,120)).join('\n\n'):'No open reports.'; }
    case 'reportstats': return 'Reports total: '+await count('SELECT COUNT(*)::int AS count FROM reports')+'\nOpen: '+await count("SELECT COUNT(*)::int AS count FROM reports WHERE status IN ('open','reviewing')")+'\nClosed: '+await count("SELECT COUNT(*)::int AS count FROM reports WHERE status IN ('resolved','dismissed')");
    case 'flags': case 'flagqueue': { const list=await rows("SELECT mf.id,mf.category,mf.reason,u.first_name,u.username FROM moderation_flags mf JOIN users u ON u.id=mf.user_id WHERE mf.status IN ('open','reviewing') ORDER BY mf.created_at DESC LIMIT 12"); return list.length?'OPEN MODERATION FLAGS\n'+list.map(r=>'#'+r.id+' — '+r.first_name+(r.username?' (@'+r.username+')':'')+'\n'+r.category+': '+r.reason).join('\n\n'):'No open moderation flags.'; }
    case 'flagstats': return 'Flags total: '+await count('SELECT COUNT(*)::int AS count FROM moderation_flags')+'\nOpen: '+await count("SELECT COUNT(*)::int AS count FROM moderation_flags WHERE status IN ('open','reviewing')")+'\nResolved/dismissed: '+await count("SELECT COUNT(*)::int AS count FROM moderation_flags WHERE status IN ('resolved','dismissed')");
    case 'recent': return 'RECENT ACCOUNTS\n'+fmtUsers(await rows('SELECT id,first_name,username FROM users ORDER BY created_at DESC LIMIT 15'));
    case 'inactive': return 'Active accounts not updated in 30+ days (up to 20):\n'+fmtUsers(await rows("SELECT id,first_name,username FROM users WHERE updated_at<NOW()-INTERVAL '30 days' AND account_status='active' ORDER BY updated_at ASC LIMIT 20"));
    case 'search': if (!fullArg) return 'Usage: /search name or username'; else return 'SEARCH RESULTS\n'+fmtUsers(await rows('SELECT id,first_name,username FROM users WHERE first_name ILIKE $1 OR username ILIKE $1 ORDER BY created_at DESC LIMIT 15',['%'+fullArg.replace(/^@/,'')+'%']));
    case 'bycity': if (!fullArg) return 'Usage: /bycity CITY'; else { const list=await rows('SELECT city,COUNT(*)::int AS count FROM listings WHERE city ILIKE $1 GROUP BY city ORDER BY count DESC LIMIT 10',['%'+fullArg+'%']); return list.length?list.map(r=>r.city+': '+r.count).join('\n'):'No listings found for that city.'; }
    case 'topcities': { const list=await rows("SELECT city,COUNT(*)::int AS count FROM listings WHERE city IS NOT NULL AND city<>'' GROUP BY city ORDER BY count DESC LIMIT 10"); return list.length?'TOP CITIES\n'+list.map(r=>r.city+': '+r.count).join('\n'):'No city data yet.'; }
    case 'interests': { const list=await rows("SELECT hobbies FROM listings WHERE hobbies IS NOT NULL AND hobbies<>'' ORDER BY created_at DESC LIMIT 100"); const tally={}; for(const r of list) for(const v of String(r.hobbies).split(/[,;\\n]/).map(x=>x.trim()).filter(Boolean)) tally[v]=(tally[v]||0)+1; return Object.keys(tally).length?'POPULAR INTERESTS\n'+Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([v,n])=>v+': '+n).join('\n'):'No interests recorded.'; }
    case 'likes': return 'Likes: '+await count('SELECT COUNT(*)::int AS count FROM likes')+'\nMutual matches: '+await count('SELECT COUNT(*)::int AS count FROM likes a JOIN likes b ON a.from_user=b.to_user AND a.to_user=b.from_user WHERE a.from_user<a.to_user');
    case 'matches': case 'matchstats': return 'Mutual matches: '+await count('SELECT COUNT(*)::int AS count FROM likes a JOIN likes b ON a.from_user=b.to_user AND a.to_user=b.from_user WHERE a.from_user<a.to_user');
    case 'chats': return 'Conversations with messages: '+await count('SELECT COUNT(*)::int AS count FROM (SELECT DISTINCT match_low,match_high FROM messages) conversations');
    case 'messages': return 'Messages sent: '+await count('SELECT COUNT(*)::int AS count FROM messages');
    case 'profiles': return 'Listings total: '+await count('SELECT COUNT(*)::int AS count FROM listings')+'\nPending: '+await count("SELECT COUNT(*)::int AS count FROM listings WHERE status='pending'")+'\nPublished: '+await count("SELECT COUNT(*)::int AS count FROM listings WHERE status='published'")+'\nHidden: '+await count("SELECT COUNT(*)::int AS count FROM listings WHERE status='hidden'");
    case 'verified': return 'Age-verified adults: '+await count("SELECT COUNT(*)::int AS count FROM users WHERE age_verification_status='verified' AND verified_birth_date<=CURRENT_DATE-INTERVAL '18 years'");
    case 'unverified': return 'Users awaiting age verification: '+await count("SELECT COUNT(*)::int AS count FROM users WHERE age_verification_status IN ('unverified','pending','manual_review')");
    case 'agequeue': { const list=await rows("SELECT avr.id,avr.status,avr.provider,u.first_name FROM age_verification_requests avr JOIN users u ON u.id=avr.user_id WHERE avr.status IN ('pending','manual_review') ORDER BY avr.created_at LIMIT 15"); return list.length?'AGE VERIFICATION QUEUE\n'+list.map(r=>'#'+r.id+' — '+r.first_name+' — '+r.status+' ('+r.provider+')').join('\n'):'No pending age-verification requests.'; }
    case 'staff': case 'admins': case 'moderators': case 'helpers': { const filter=command==='admins'?"WHERE role IN ('admin','chief_admin')":command==='moderators'?"WHERE role='moderator'":command==='helpers'?"WHERE role='helper'":''; const list=await rows('SELECT username,role FROM admin_roles '+filter+' ORDER BY role,username'); return list.length?'STAFF ROLES\n'+list.map(r=>(r.username?'@'+r.username:'Telegram account')+' — '+r.role).join('\n'):'No staff roles found in admin_roles.'; }
    case 'rolecheck': { if(!key)return 'Usage: /rolecheck @username or 6-digit account code'; const list=await rows("SELECT id,telegram_id,username,first_name,public_status FROM users WHERE lower(username)=lower($1) OR (lpad(id::text,6,'0')=$1 AND $1 ~ '^[0-9]{6}$') OR telegram_id::text=$1",[key]); return list.length?'Role for '+list[0].first_name+': '+(String(list[0].telegram_id)===developerId?'developer':((await rows('SELECT role FROM admin_roles WHERE telegram_id=$1',[String(list[0].telegram_id)]))[0]?.role||'none'))+'\nPublic badge: '+(list[0].public_status||'none'):'User not found.'; }
    case 'permissions': case 'myrole': return 'Your role: '+role+'\nAdmin commands: enabled\nOnly the developer can assign administrative roles and public badges.';
    case 'statuslist': { const list=await rows("SELECT COALESCE(NULLIF(public_status,''),'none') AS status,COUNT(*)::int AS count FROM users GROUP BY 1 ORDER BY count DESC"); return 'PUBLIC PROFILE BADGES\n'+list.map(r=>r.status+': '+r.count).join('\n'); }
    case 'review': case 'resolve': case 'dismiss': { if(!Number.isSafeInteger(numericId)||numericId<=0)return 'Usage: /'+command+' REPORT_OR_FLAG_ID'; const status=command==='review'?'reviewing':command==='resolve'?'resolved':'dismissed'; let q=await pool.query('UPDATE reports SET status=$1 WHERE id=$2 RETURNING id',[status,numericId]); if(!q.rowCount)q=await pool.query('UPDATE moderation_flags SET status=$1 WHERE id=$2 RETURNING id',[status,numericId]); return q.rowCount?'Moderation item #'+numericId+' set to '+status+'.':'No report or flag found with that ID.'; }
    case 'approve': return setListingStatus('published'); case 'reject': return setListingStatus('rejected'); case 'hide': return setListingStatus('hidden'); case 'show': return setListingStatus('published');
    case 'restrict': return changeUserStatus('restricted'); case 'suspend': return changeUserStatus('suspended'); case 'restore': return changeUserStatus('active');
    case 'health': case 'dbcheck': await pool.query('SELECT 1'); return 'VIBE API is running; database connection is healthy.';
    case 'ping': return 'VIBE bot is online.';
    case 'botinfo': return 'VIBE Telegram Mini App\nAPI: '+apiUrl+'\nClient: '+clientUrl+'\nCommand permissions are checked on the server.';
    case 'queueall': return 'OPEN REPORTS: '+await count("SELECT COUNT(*)::int AS count FROM reports WHERE status IN ('open','reviewing')")+'\nOPEN FLAGS: '+await count("SELECT COUNT(*)::int AS count FROM moderation_flags WHERE status IN ('open','reviewing')")+'\nPENDING LISTINGS: '+await count("SELECT COUNT(*)::int AS count FROM listings WHERE status='pending'")+'\nPENDING AGE CHECKS: '+await count("SELECT COUNT(*)::int AS count FROM age_verification_requests WHERE status IN ('pending','manual_review')");
    case 'profilequeue': { const list=await rows("SELECT id,name,city,status FROM listings WHERE status='pending' ORDER BY created_at LIMIT 20"); return list.length?'PENDING PROFILE LISTINGS\n'+list.map(r=>'#'+r.id+' — '+r.name+' — '+r.city).join('\n'):'No pending listings.'; }
    case 'oldreports': { const list=await rows("SELECT id,reason,created_at FROM reports WHERE status IN ('open','reviewing') AND created_at<NOW()-INTERVAL '7 days' ORDER BY created_at LIMIT 15"); return list.length?'REPORTS OLDER THAN 7 DAYS\n'+list.map(r=>'#'+r.id+' — '+r.reason+' — '+new Date(r.created_at).toLocaleDateString()).join('\n'):'No old open reports.'; }
    case 'closedreports': return 'Closed reports: '+await count("SELECT COUNT(*)::int AS count FROM reports WHERE status IN ('resolved','dismissed')");
    case 'banned': case 'restricted': case 'suspended': return fmtUsers(await rows('SELECT id,first_name,username FROM users WHERE account_status=$1 ORDER BY updated_at DESC LIMIT 20',[command]));
    case 'blocked': case 'blocks': return 'Block relationships: '+await count('SELECT COUNT(*)::int AS count FROM blocks');
    case 'likesstats': return 'Likes sent: '+await count('SELECT COUNT(*)::int AS count FROM likes')+'\nDistinct users who liked: '+await count('SELECT COUNT(DISTINCT from_user)::int AS count FROM likes')+'\nUsers who received likes: '+await count('SELECT COUNT(DISTINCT to_user)::int AS count FROM likes');
    case 'activity': return 'New accounts (24h): '+await count("SELECT COUNT(*)::int AS count FROM users WHERE created_at>=NOW()-INTERVAL '24 hours'")+'\nNew listings (24h): '+await count("SELECT COUNT(*)::int AS count FROM listings WHERE created_at>=NOW()-INTERVAL '24 hours'")+'\nMessages (24h): '+await count("SELECT COUNT(*)::int AS count FROM messages WHERE created_at>=NOW()-INTERVAL '24 hours'");
    default: return 'Unknown command.';
  }
}
