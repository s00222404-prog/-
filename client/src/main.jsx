import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Compass, UserRound, ShieldAlert, MapPin, Sparkles, ArrowRight, Lock, RefreshCw, MessageCircle, ImagePlus, PlusCircle, BadgeCheck, Crown, ShieldCheck, Wrench, LayoutGrid, Rows3, Flag } from 'lucide-react';
import './style.css';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const webApp = window.Telegram?.WebApp;
const initData = webApp?.initData || '';

function RoleBadge({ role, label }) {
  if (!label || !role || role === 'none') return null;
  const Icon = role === 'developer' || role === 'chief_admin' ? Crown : role === 'admin' ? ShieldCheck : role === 'moderator' ? BadgeCheck : Wrench;
  return <span className={'role-badge role-' + role}><span className="role-badge-icon"><Icon size={13} strokeWidth={2.6}/></span><span>{label}</span><span className="role-badge-glint" aria-hidden="true"/></span>;
}

function App() {
  const [tab, setTab] = useState('discover');
  const [displayMode, setDisplayMode] = useState('large');
  const [user, setUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [likesData, setLikesData] = useState({incoming:[],outgoing:[]});
  const [myListing, setMyListing] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reportingPerson, setReportingPerson] = useState(null);
  const [reportType, setReportType] = useState('profile');
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reporterUsername, setReporterUsername] = useState('');
  const [reportedUsername, setReportedUsername] = useState('');
  const [reportEvidence, setReportEvidence] = useState('');
  const [reportEvidenceName, setReportEvidenceName] = useState('');
  const [feedIndex, setFeedIndex] = useState(0);
  const [listingMediaUrl, setListingMediaUrl] = useState('');
  const [listingMediaType, setListingMediaType] = useState('image');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [profile, setProfile] = useState({ birthDate: '', gender: '', bio: '', city: '', photoUrl: '', goal: 'both', interests: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ageStatus, setAgeStatus] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [listing, setListing] = useState({name:'',age:'',city:'',country:'',hobbies:'',description:''});
  const [publishing, setPublishing] = useState(false);

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'Ошибка сервера (' + response.status + ')');
      error.banned = Boolean(data.banned);
      error.banReason = data.reason || data.moderation_note || data.user?.moderation_note || '';
      error.banIssuer = data.ban_issuer_label || ((data.ban_issuer || data.user?.ban_issuer) === 'developer' ? 'разработчиком' : 'модератором');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function loadApp() {
    setLoading(true);
    setError('');
    try {
      if (!API) throw new Error('Не задан VITE_API_URL в настройках сайта Render.');
      if (!initData) throw new Error('Открой VIBE через кнопку бота в Telegram. В обычном браузере вход через Telegram не подтверждён.');
      webApp?.ready();
      webApp?.expand();
      const auth = await request('/api/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) });
      setUser(auth.user);
      const me = await request('/api/me');
      setUser(me.user);
      const u = me.user;
      setProfile({
        birthDate: u.birth_date ? String(u.birth_date).slice(0, 10) : '',
        gender: u.gender || '',
        bio: u.bio || '',
        city: u.city || '',
        photoUrl: u.photo_url || '',
        goal: u.goal || 'both',
        interests: Array.isArray(u.interests) ? u.interests.join(', ') : ''
      });
      const age = await request('/api/age-status');
      setAgeStatus(age);
      const discovery = await request('/api/discover');
      setPeople(discovery.people || []);
      const mine = await request('/api/listings/mine').catch(() => ({listing:null}));
      setMyListing(mine.listing || null);
      if (mine.listing) { setListing({name:mine.listing.name,age:String(mine.listing.age),city:mine.listing.city,country:mine.listing.country,hobbies:mine.listing.hobbies||'',description:mine.listing.description||''}); setListingMediaUrl(mine.listing.media_url||''); setListingMediaType(mine.listing.media_type||'image'); }
      const chatData = await request('/api/chats');
      setChats(chatData.chats || []);
      const likes = await request('/api/likes').catch(() => ({incoming:[],outgoing:[]}));
      setLikesData({incoming:likes.incoming||[],outgoing:likes.outgoing||[]});
    } catch (e) {
      if (e.banned) {
        setUser({ account_status: 'banned', moderation_note: e.banReason, ban_issuer_label: e.banIssuer });
        setError('');
      } else setError(e.message || 'Не удалось подключиться к VIBE API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (initData) loadApp(); else setLoading(false); }, []);

  async function chooseMedia(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setNotice('');
    if (!file.type.startsWith('image/')) {
      setError('Для фото профиля выбери изображение. Видео можно добавить в публикацию ленты.');
      e.target.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Файл слишком большой. Максимальный размер изображения — 3 МБ.');
      e.target.value = '';
      return;
    }
    setUploadingMedia(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
        reader.readAsDataURL(file);
      });
      setProfile(current => ({ ...current, photoUrl: String(dataUrl) }));
      setNotice('Фото выбрано. Нажми «Сохранить анкету», чтобы применить изменения.');
    } catch (e) {
      setError(e.message || 'Не удалось загрузить фото.');
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/me', {
        method: 'PUT',
        body: JSON.stringify({
          birthDate: profile.birthDate || null,
          gender: profile.gender || null,
          bio: profile.bio,
          city: profile.city || null,
          photoUrl: profile.photoUrl || null,
          goal: profile.goal,
          interests: profile.interests.split(',').map(x => x.trim()).filter(Boolean).slice(0, 20)
        })
      });
      setUser(result.user);
      const age = await request('/api/age-status');
      setAgeStatus(age);
      const discovery = await request('/api/discover');
      setPeople(discovery.people || []);
      setNotice('Профиль сохранён.');
    } catch (e) {
      setError(e.message || 'Не удалось сохранить профиль.');
    } finally {
      setSaving(false);
    }
  }

  async function like(person) {
    try {
      const result = await request('/api/likes/' + encodeURIComponent(person.id), { method: 'POST' });
      setPeople(current => current.filter(p => p.id !== person.id));
      setLikesData(current => ({incoming:current.incoming.filter(p=>String(p.id)!==String(person.id)),outgoing:[person,...current.outgoing.filter(p=>String(p.id)!==String(person.id))]}));
      setNotice(result.matched ? 'У вас взаимная симпатия 💜' : 'Симпатия отправлена.');
    } catch (e) { setError(e.message); }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!reportingPerson) return;
    if (!reportReason.trim() || !reporterUsername.trim() || !reportedUsername.trim()) {
      setError('Укажи свой Telegram-юзернейм, юзернейм пользователя и обязательную причину жалобы.');
      return;
    }
    setReportSubmitting(true); setError('');
    try {
      await request('/api/reports/' + encodeURIComponent(reportingPerson.id), { method:'POST', body:JSON.stringify({reason:reportReason,details:reportDetails,reporterUsername:reporterUsername.trim(),reportedUsername:reportedUsername.trim(),evidence:reportEvidence,reportType,listingId:reportingPerson.listing_id || null}) });
      setReportingPerson(null); setReportDetails(''); setReportEvidence(''); setReportEvidenceName(''); setReportReason('');
      setNotice('Жалоба отправлена модерации. Спасибо за сигнал.');
    } catch (e) { setError(e.message || 'Не удалось отправить жалобу.'); }
    finally { setReportSubmitting(false); }
  }

  async function refreshChats() {
    try { const data = await request('/api/chats'); setChats(data.chats || []); }
    catch (e) { setError(e.message); }
  }

  async function openChat(chat) {
    try {
      setActiveChat(chat);
      const data = await request('/api/chats/' + encodeURIComponent(chat.user_id) + '/messages');
      setMessages(data.messages || []);
      setTab('chat');
    } catch (e) { setError(e.message); }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!activeChat || !draft.trim()) return;
    try {
      const data = await request('/api/chats/' + encodeURIComponent(activeChat.user_id) + '/messages', {
        method: 'POST', body: JSON.stringify({ body: draft.trim() })
      });
      setMessages(current => [...current, data.message]);
      setDraft('');
    } catch (e) { setError(e.message); }
  }

  async function publishListing(e) {
    e.preventDefault();
    setPublishing(true); setError(''); setNotice('');
    try {
      const result=await request('/api/listings',{method:'POST',body:JSON.stringify({...listing,age:Number(listing.age),mediaUrl:listingMediaUrl||null,mediaType:listingMediaType})});
      const savedListing={...result.listing,age:String(result.listing.age)};
      setListing(savedListing);
      setMyListing(savedListing);
      setListingMediaUrl(savedListing.media_url || ''); setListingMediaType(savedListing.media_type || 'image');
      const discovery=await request('/api/discover'); setPeople(discovery.people||[]);
      setNotice('Анкета сохранена и отправлена на проверку. Она станет видна другим после одобрения. Ты можешь видеть свою анкету в рекомендациях.');
      setTab('discover');
    } catch(e) { setError(e.message||'Не удалось опубликовать анкету.'); }
    finally { setPublishing(false); }
  }

  async function skip(person) {
    // Hiding a card is only a local action; it does not create a like.
    setPeople(current => current.filter(p => p.id !== person.id));
  }

  if (user?.account_status === 'banned') return <main className={tab === 'discover' ? 'app-shell feed-mode' : 'app-shell'}><section className="panel" role="alert" style={{margin:'10vh auto',maxWidth:560,textAlign:'center'}}><div className="panel-icon"><ShieldAlert/></div><h1>Ваш аккаунт забанен</h1><p>Доступ к VIBE закрыт.</p><p><b>Кем заблокирован:</b> {user.ban_issuer_label || (user.ban_issuer === 'developer' ? 'разработчиком' : 'модератором')}</p><p><b>Причина:</b> {user.moderation_note || user.reason || 'Причина не указана'}</p></section></main>;
  if (!initData) return <Landing />;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><span className="online"><i/> {user ? 'Telegram подключён' : 'знакомства'}</span><button className="avatar" aria-label="Открыть мой профиль" onClick={() => setProfileOpen(true)}>{user?.photo_url ? <img src={user.photo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/> : (user?.first_name || 'Я').slice(0, 1)}</button></header>
    <section className="hero"><div className="eyebrow"><Sparkles size={14}/> ТВОЯ ВОЛНА</div><h1>Люди, с которыми<br/><span>совпадает вайб.</span></h1><p>Настоящие анкеты пользователей VIBE — без выдуманных профилей.</p></section>
    <nav className="tabs"><button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass size={17}/> Знакомства</button><button className={tab === 'likes' ? 'active' : ''} onClick={async () => { setTab('likes'); try { const data = await request('/api/likes'); setLikesData({incoming:data.incoming||[],outgoing:data.outgoing||[]}); } catch(e) { setError(e.message); } }}><Heart size={17}/> Симпатии <span className="tab-count">{likesData.incoming.length}</span></button><button className={tab === 'listing' ? 'active' : ''} onClick={() => { setProfileOpen(false); setTab('listing'); }}><PlusCircle size={17}/> Моя анкета</button><button className={tab === 'chats' || tab === 'chat' ? 'active' : ''} onClick={() => { setTab('chats'); refreshChats(); }}><MessageCircle size={17}/> Чаты <span className="tab-count">{chats.length}</span></button></nav>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    {error && <div className="notice" role="alert"><ShieldAlert size={16}/><span>{error}</span><button onClick={loadApp} title="Повторить"><RefreshCw size={15}/></button></div>}
    {loading && <div className="panel"><p>Подключаем VIBE…</p></div>}
    {!loading && tab === 'discover' && <section className="people tiktok-feed">
      <div className="feed-topline"><div><span className="feed-kicker"><Sparkles size={13}/> VIBE FEED</span><h2>Лента для тебя</h2></div><span className="count">{people.length} публикаций</span></div>
      {people.length === 0 && <div className="empty"><Sparkles/><h3>Лента пока пуста</h3><p>Публикации появятся, когда пользователи добавят фото или видео и их анкеты будут одобрены.</p><button className="save" onClick={() => setTab('listing')}><PlusCircle size={16}/> Добавить публикацию</button></div>}
      <div className="feed-scroll" onScroll={e=>{const el=e.currentTarget;setFeedIndex(Math.round(el.scrollTop/Math.max(el.clientHeight,1)));}}>
      {people.map((p,i) => <article className="feed-post" key={p.id} data-index={i}>
        <div className="feed-media">
          {(p.media_type === 'video' && p.media_url) ? <video className="feed-media-asset" src={p.media_url} controls playsInline loop muted preload="metadata"/> :
            (p.media_url || p.photo_url) ? <img className="feed-media-asset" src={p.media_url || p.photo_url} alt={'Публикация: ' + (p.name || 'пользователь')}/> :
            <div className="profile-cover-placeholder feed-placeholder"><span>{(p.name || '?').slice(0,1).toUpperCase()}</span><small>ТВОЙ ВАЙБ. ТВОЯ ИСТОРИЯ.</small></div>}
          <div className="feed-media-shade"/>
          <div className="feed-profile-copy"><button className="feed-name" onClick={()=>setViewingProfile(p)}>{p.name || 'Пользователь'}{p.age ? ', '+p.age : ''}</button><RoleBadge role={p.public_role} label={p.role_label}/><span className="profile-location"><MapPin size={13}/>{[p.city,p.country].filter(Boolean).join(', ') || 'Местоположение не указано'}</span><p>{p.description || p.bio || 'Пока ничего не рассказал о себе.'}</p>{(p.interests || []).length>0 && <div className="profile-interests">{p.interests.slice(0,5).map(x=><span key={x}>#{x}</span>)}</div>}</div>
          <div className="feed-action-rail">
            {String(p.id)!==String(user?.id) && <><button onClick={()=>like(p)} aria-label="Поставить лайк" title="Лайк"><Heart size={25} fill="currentColor"/><span>Лайк</span></button><button onClick={()=>openChat({user_id:p.id,first_name:p.name||'Пользователь',photo_url:p.photo_url})} aria-label="Написать в личные сообщения" title="Написать"><MessageCircle size={24}/><span>ЛС</span></button><button onClick={()=>{setReportingPerson(p);setReportType('post');setReportReason('');setReportDetails('');setReporterUsername(user?.username?'@'+user.username:'');setReportedUsername(p.username?'@'+p.username:'');setReportEvidence('');setReportEvidenceName('');}} aria-label="Пожаловаться на публикацию" title="Пожаловаться"><Flag size={23}/><span>Жалоба</span></button></>}
          </div>
        </div>
        <div className="feed-post-footer"><span>@{(p.username || p.name || 'vibe').replace(/^@/,'')}</span><button onClick={()=>setViewingProfile(p)}>Профиль <ArrowRight size={14}/></button><span>{i+1} / {people.length}</span></div>
      </article>)}
      </div>
    </section>}
    {viewingProfile && <div className="report-overlay"><section className="panel report-dialog"><button className="back-chat" onClick={() => setViewingProfile(null)}>← Назад</button><h2>{viewingProfile.name || 'Пользователь'}{viewingProfile.age ? ', ' + viewingProfile.age : ''}</h2><RoleBadge role={viewingProfile.public_role} label={viewingProfile.role_label}/>{viewingProfile.media_type==='video'&&viewingProfile.media_url ? <video src={viewingProfile.media_url} controls playsInline style={{width:'100%',maxHeight:360,borderRadius:14,background:'#0f0d16',margin:'14px 0'}}/> : (viewingProfile.media_url||viewingProfile.photo_url) ? <img src={viewingProfile.media_url||viewingProfile.photo_url} alt="Медиа анкеты" style={{width:'100%',maxHeight:320,objectFit:'contain',borderRadius:14,background:'#0f0d16',margin:'14px 0'}}/> : null}<p><b>Город:</b> {[viewingProfile.city,viewingProfile.country].filter(Boolean).join(', ') || 'Не указан'}</p><p><b>О себе:</b> {viewingProfile.description || viewingProfile.bio || 'Описание не добавлено.'}</p><p><b>Интересы:</b> {(viewingProfile.interests || []).join(', ') || 'Не указаны'}</p>{String(viewingProfile.id) !== String(user?.id) && <div className="profile-actions"><button className="like" onClick={() => { const person = viewingProfile; setViewingProfile(null); like(person); }}><Heart size={17} fill="currentColor"/> Поставить лайк</button><button className="save" onClick={() => openChat({user_id:viewingProfile.id,first_name:viewingProfile.name || 'Пользователь',photo_url:viewingProfile.photo_url})}><MessageCircle size={17}/> Написать в ЛС</button><button className="skip" onClick={() => { setReportingPerson(viewingProfile); setReportType('profile'); setReportReason(''); setReportDetails(''); setReporterUsername(user?.username?'@'+user.username:''); setReportedUsername(viewingProfile.username?'@'+viewingProfile.username:''); setReportEvidence(''); setReportEvidenceName(''); setViewingProfile(null); }}>Пожаловаться</button></div>}</section></div>}


    {!loading && tab === 'likes' && <section className="panel">
      <div className="panel-icon"><Heart/></div><h2>Симпатии</h2>
      <p>Посмотри, кто поставил тебе лайк, и управляй своими симпатиями.</p>
      <h3>Тебе поставили лайк · {likesData.incoming.length}</h3>
      {likesData.incoming.length===0 ? <p className="field-hint">Пока нет новых симпатий. Продолжай знакомиться в ленте.</p> : likesData.incoming.map(person=><div className="chat-row" key={'in-'+person.id}>
        <span className="chat-avatar">{person.photo_url?<img src={person.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>:(person.name||'?').slice(0,1)}</span>
        <span className="chat-row-copy"><b>{person.name}{person.age?', '+person.age:''}</b><small>{[person.city,person.country].filter(Boolean).join(', ')||'VIBE'}</small></span>
        <button className="like" onClick={()=>like(person)}><Heart size={15} fill="currentColor"/> Взаимно</button>
      </div>)}
      <h3 style={{marginTop:24}}>Ты поставил лайк · {likesData.outgoing.length}</h3>
      {likesData.outgoing.length===0 ? <p className="field-hint">Здесь появятся анкеты, которым ты поставишь лайк.</p> : likesData.outgoing.map(person=><div className="chat-row" key={'out-'+person.id}>
        <span className="chat-avatar">{person.photo_url?<img src={person.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>:(person.name||'?').slice(0,1)}</span>
        <span className="chat-row-copy"><b>{person.name}{person.age?', '+person.age:''}</b><small>{[person.city,person.country].filter(Boolean).join(', ')||'VIBE'}</small></span>
        <button className="save" onClick={()=>openChat({user_id:person.id,first_name:person.name||'Пользователь',photo_url:person.photo_url})}><MessageCircle size={15}/> Написать</button>
      </div>)}
      <button className="save" style={{marginTop:18}} onClick={() => { setTab('chats'); refreshChats(); }}>Открыть чаты <MessageCircle size={16}/></button>
    </section>}
    {!loading && tab === 'chats' && <section className="panel"><div className="panel-icon"><MessageCircle/></div><h2>Твои чаты</h2><p>Переписывайся напрямую с людьми из ленты VIBE.</p>{chats.length === 0 ? <div className="empty"><Heart/><h3>Пока нет чатов</h3><p>Открой ленту и нажми «ЛС» у понравившегося человека, чтобы начать разговор.</p></div> : chats.map(chat => <button className="chat-row" key={chat.user_id} onClick={() => openChat(chat)}><span className="chat-avatar">{(chat.first_name || '?').slice(0,1)}</span><span className="chat-row-copy"><b>{chat.first_name}</b><small>{chat.last_message || 'Начни разговор 👋'}</small></span><MessageCircle size={18}/></button>)}</section>}
    {!loading && tab === 'chat' && activeChat && <section className="panel chat-panel"><button className="back-chat" onClick={() => { setTab('chats'); refreshChats(); }}>← Все чаты</button><h2>Чат с {activeChat.first_name}</h2><div className="messages-list">{messages.map(message => <div className={'message-bubble ' + (String(message.sender_id) === String(user?.id) ? 'mine' : '')} key={message.id}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}</div><form className="chat-compose" onSubmit={sendMessage}><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} placeholder="Напиши сообщение…" required/><button className="like" type="submit"><ArrowRight size={17}/></button></form></section>}
    {!loading && tab === 'listing' && <section className="panel profile-panel"><div className="panel-icon"><PlusCircle/></div><h2>Добавить анкету</h2><p>Это отдельная публичная анкета для рекомендаций. Она не меняет данные твоего профиля Telegram.</p><form onSubmit={publishListing}>
      <label>Имя<input value={listing.name} onChange={e=>setListing({...listing,name:e.target.value})} minLength={2} maxLength={60} placeholder="Как тебя показывать" required/></label>
      <label>Возраст (числом)<input type="number" inputMode="numeric" min="18" max="100" step="1" value={listing.age} onChange={e=>setListing({...listing,age:e.target.value})} placeholder="Например, 22" required/></label>
      <label>Город<input value={listing.city} onChange={e=>setListing({...listing,city:e.target.value})} minLength={2} maxLength={80} placeholder="Например, Берлин" required/></label>
      <label>Страна<input value={listing.country} onChange={e=>setListing({...listing,country:e.target.value})} minLength={2} maxLength={80} placeholder="Например, Германия" required/></label>
      <label>Фото или видео для ленты<span className="media-picker"><ImagePlus size={17}/>{listingMediaUrl ? 'Медиа выбрано · '+(listingMediaType==='video'?'видео':'фото') : 'Выбрать фото или видео'}<input type="file" accept="image/*,video/*" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const isVideo=file.type.startsWith('video/');if(!file.type.startsWith('image/')&&!isVideo){setError('Выбери фото или видео.');e.target.value='';return;}if(file.size>3*1024*1024){setError('Медиа должно быть не больше 3 МБ.');e.target.value='';return;}try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось прочитать медиа'));reader.readAsDataURL(file);});setListingMediaUrl(data);setListingMediaType(isVideo?'video':'image');setError('');setNotice('Медиа готово к публикации.');}catch(err){setError(err.message);}e.target.value='';}}/></span></label>{listingMediaUrl && <div className="listing-media-preview">{listingMediaType==='video'?<video src={listingMediaUrl} controls playsInline/>:<img src={listingMediaUrl} alt="Предпросмотр публикации"/>}<button className="skip" type="button" onClick={()=>{setListingMediaUrl('');setListingMediaType('image');}}>Убрать медиа</button></div>}
      <label>Хобби и занятия<textarea value={listing.hobbies} onChange={e=>setListing({...listing,hobbies:e.target.value})} maxLength={300} placeholder="Музыка, спорт, игры, прогулки…"/></label>
      <label>Описание<textarea value={listing.description} onChange={e=>setListing({...listing,description:e.target.value})} maxLength={1000} placeholder="Расскажи о себе без мата и пошлостей" required/></label>
      <p className="field-hint">Перед публикацией проверяем текст на ругательства и пошлые выражения. Возраст анкеты должен быть 18+.</p>
      <button className="save" type="submit" disabled={publishing}><PlusCircle size={16}/>{publishing?'Публикуем…':'Опубликовать анкету'}<ArrowRight size={16}/></button>
    </form></section>}
    {profileOpen && <div className="report-overlay" onClick={e => { if (e.target === e.currentTarget) setProfileOpen(false); }}><section className="panel report-dialog profile-modal account-profile-modal"><button className="back-chat" type="button" onClick={() => setProfileOpen(false)}>← Закрыть профиль</button><div className="account-avatar">{user?.photo_url ? <img src={user.photo_url} alt="Аватар" /> : <UserRound size={42}/>}</div><h2>{user?.username ? '@' + user.username : (user?.first_name || 'Пользователь')}</h2><RoleBadge role={user?.public_role} label={user?.role_label}/><div className="account-profile-stats"><div><span>Код аккаунта</span><strong>{user?.account_code || String(user?.id || '').padStart(6,'0')}</strong></div><div><span>Симпатии</span><strong><Heart size={17} fill="currentColor"/> {user?.likes_received || 0}</strong></div></div>
      <form className="profile-panel profile-editor-form" onSubmit={saveProfile}>
        <h3>Настроить анкету</h3>
        <p className="field-hint">Эти данные помогают VIBE подбирать совместимые знакомства. Не указывай точный адрес.</p>
        <label>Фото профиля
          {profile.photoUrl && <img className="profile-editor-photo" src={profile.photoUrl} alt="Предпросмотр фото профиля"/>}
          <span className="media-picker"><ImagePlus size={17}/>{uploadingMedia ? 'Обрабатываем фото…' : 'Выбрать фото'}<input type="file" accept="image/*" onChange={chooseMedia} disabled={uploadingMedia}/></span>
        </label>
        <label>Дата рождения<input type="date" value={profile.birthDate} max={new Date().toISOString().slice(0,10)} onChange={e=>setProfile({...profile,birthDate:e.target.value})}/><span className="field-hint">Дата используется для возрастных ограничений и проверки доступа.</span></label>
        <label>Пол<select value={profile.gender} onChange={e=>setProfile({...profile,gender:e.target.value})}><option value="">Не указан</option><option value="woman">Женский</option><option value="man">Мужской</option><option value="nonbinary">Небинарный</option><option value="prefer_not_to_say">Не хочу указывать</option></select></label>
        <label>Город<input value={profile.city} maxLength={80} onChange={e=>setProfile({...profile,city:e.target.value})} placeholder="Например, Берлин"/></label>
        <label>О себе<textarea value={profile.bio} maxLength={500} onChange={e=>setProfile({...profile,bio:e.target.value})} placeholder="Расскажи немного о себе…"/></label>
        <label>Цель знакомства<select value={profile.goal} onChange={e=>setProfile({...profile,goal:e.target.value})}><option value="both">Общение и отношения</option><option value="friendship">Дружба</option><option value="chat">Общение</option><option value="relationship">Отношения</option></select></label>
        <label>Интересы через запятую<input value={profile.interests} maxLength={500} onChange={e=>setProfile({...profile,interests:e.target.value})} placeholder="Музыка, игры, кино, спорт"/></label>
        {ageStatus && !ageStatus.adultAccess && <p className="field-hint">Заполнение даты рождения не заменяет проверку возраста, если она требуется для доступа к функциям знакомств.</p>}
        <button className="save" type="submit" disabled={saving || uploadingMedia}><Lock size={15}/>{saving ? 'Сохраняем…' : 'Сохранить анкету'}</button>
        <button className="skip profile-public-listing-link" type="button" onClick={() => { setProfileOpen(false); setTab('listing'); }}><PlusCircle size={15}/> Управлять публичной анкетой</button>
      </form>
      </section></div>}
    {reportingPerson && <div className="report-overlay" onClick={e=>{if(e.target===e.currentTarget){setReportingPerson(null);setError('');}}}><section className="panel report-dialog"><button className="back-chat" type="button" onClick={()=>{setReportingPerson(null);setError('');}}>← Назад</button><h2>Пожаловаться на {reportType === 'post' ? 'публикацию' : 'профиль'}</h2><p>Жалоба отправится модерации VIBE. Причина обязательна; доказательства можно приложить, если они есть.</p><form onSubmit={submitReport}><label>Твой Telegram-юзернейм<input value={reporterUsername} onChange={e=>setReporterUsername(e.target.value)} placeholder="@твой_username" maxLength={64} required/></label><label>Telegram-юзернейм пользователя<input value={reportedUsername} onChange={e=>setReportedUsername(e.target.value)} placeholder="@username_на_кого_жалоба" maxLength={64} required/></label><label>Обязательная причина<select value={reportReason} onChange={e=>setReportReason(e.target.value)} required><option value="" disabled>Выбери причину</option><option>Спам</option><option>Оскорбления или угрозы</option><option>Фейковая анкета</option><option>Неприемлемый контент</option><option>Подозрение на мошенничество</option><option>Преследование или угрозы безопасности</option><option>Другое</option></select></label><label>Подробности<textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} maxLength={1000} placeholder="Опиши, что произошло (необязательно)"/></label><label>Доказательства (необязательно)<span className="media-picker"><ImagePlus size={17}/>{reportEvidenceName || 'Прикрепить фото, видео или PDF'}<input type="file" accept="image/*,video/*,application/pdf" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){setError('Доказательство должно быть не больше 2 МБ.');e.target.value='';return;}try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось прочитать файл'));reader.readAsDataURL(file);});setReportEvidence(data);setReportEvidenceName(file.name);setError('');}catch(err){setError(err.message);}e.target.value='';}}/></span></label>{reportEvidence && <button className="skip" type="button" onClick={()=>{setReportEvidence('');setReportEvidenceName('');}}>Убрать доказательство</button>}<button className="save" type="submit" disabled={reportSubmitting}>{reportSubmitting?'Отправляем…':'Отправить жалобу'}</button></form></section></div>}
    <nav className="mobile-nav" aria-label="Основная навигация"><button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass size={20}/><span>Поиск</span></button><button className={tab === 'likes' ? 'active' : ''} onClick={async () => { setTab('likes'); try { const data = await request('/api/likes'); setLikesData({incoming:data.incoming||[],outgoing:data.outgoing||[]}); } catch(e) { setError(e.message); } }}><Heart size={20}/><span>Симпатии</span>{likesData.incoming.length > 0 && <i>{likesData.incoming.length}</i>}</button><button className={tab === 'chats' || tab === 'chat' ? 'active' : ''} onClick={() => { setTab('chats'); refreshChats(); }}><MessageCircle size={20}/><span>Чаты</span>{chats.length > 0 && <i>{chats.length}</i>}</button><button className={profileOpen ? 'active' : ''} onClick={() => setProfileOpen(true)}><UserRound size={20}/><span>Профиль</span></button></nav>
    <footer><span>vibe. © 2026</span><span><Lock size={12}/> Безопасность важна</span></footer>
  </main>;
}


function Landing() {
  return <main className="app-shell landing-shell">
    <header className="topbar landing-topbar">
      <a className="brand" href="#" aria-label="VIBE главная"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></a>
      <div className="landing-top-actions"><span className="landing-online"><i/> Знакомства нового уровня</span><a className="landing-menu" href="#about">О VIBE <ArrowRight size={14}/></a></div>
    </header>
    <section className="landing-hero">
      <div className="landing-copy">
        <div className="eyebrow"><Sparkles size={14}/> ТВОЯ ВОЛНА · ТВОИ ЛЮДИ</div>
        <h1>Не просто<br/>знакомства.<br/><span>Совпадение вайбов.</span></h1>
        <p>Меньше случайных свайпов. Больше людей, с которыми есть о чём поговорить. Найди своё общение прямо в Telegram.</p>
        <a className="register-button" href="https://t.me/iBEDatig_Bot?start=register"><span className="telegram-icon">➤</span> Начать знакомство <ArrowRight size={18}/></a>
        <div className="landing-trust"><span><Lock size={14}/> Вход через Telegram</span><span><ShieldCheck size={14}/> Контроль приватности</span></div>
      </div>
      <div className="landing-visual" aria-label="Пример карточки знакомства">
        <div className="landing-orbit landing-orbit-one"/><div className="landing-orbit landing-orbit-two"/>
        <div className="landing-float-chip landing-float-top"><Sparkles size={15}/> По общим интересам</div>
        <article className="landing-demo-card">
          <div className="landing-demo-photo"><div className="landing-demo-glow"/><span className="landing-demo-monogram">v.</span><span className="landing-demo-tag"><i/> ТВОЙ ТИП ЛЮДЕЙ</span></div>
          <div className="landing-demo-info"><div><span className="landing-demo-kicker">ВОЗМОЖНО, ВАШ ВАЙБ</span><h2>Новые люди<span> · настоящие истории</span></h2></div><div className="landing-demo-actions"><span><Heart size={17}/></span><span><MessageCircle size={17}/></span></div></div>
        </article>
        <div className="landing-float-chip landing-float-bottom"><Heart size={15} fill="currentColor"/> Взаимная симпатия</div>
        <div className="landing-orbit-dot dot-a">✦</div><div className="landing-orbit-dot dot-b">♡</div>
      </div>
    </section>
    <section className="landing-proof"><div><strong>01</strong><span>Анкеты по интересам</span></div><div><strong>02</strong><span>Симпатии и совпадения</span></div><div><strong>03</strong><span>Общение в одном месте</span></div></section>
    <section className="landing-about" id="about">
      <div className="landing-section-heading"><span className="eyebrow"><Sparkles size={13}/> ТВОЙ VIBE</span><h2>Знакомься так,<br/><span>как тебе комфортно.</span></h2><p>Всё важное — просто, красиво и без лишней суеты.</p></div>
      <div className="landing-features">
        <article className="landing-feature-card feature-purple"><span className="feature-icon"><Heart/></span><span className="feature-number">01 / CONNECT</span><h3>Встречай своих</h3><p>Открывай анкеты людей, которые могут совпасть с тобой по интересам и целям знакомства.</p><div className="feature-art feature-heart"><Heart size={72}/><Sparkles size={23}/></div></article>
        <article className="landing-feature-card feature-blue"><span className="feature-icon"><Sparkles/></span><span className="feature-number">02 / DISCOVER</span><h3>Меньше случайности</h3><p>Подборка использует информацию анкеты, чтобы знакомиться было проще и интереснее.</p><div className="feature-art feature-spark"><span>✳</span><span>✦</span><span>✧</span></div></article>
        <article className="landing-feature-card feature-pink"><span className="feature-icon"><MessageCircle/></span><span className="feature-number">03 / TALK</span><h3>Начинай общение</h3><p>Симпатии, совпадения и чаты собраны в одном приложении внутри Telegram.</p><div className="feature-art feature-chat"><span>Привет! 👋</span><span>Кажется, у нас общий вайб</span></div></article>
      </div>
    </section>
    <section className="landing-final-cta"><div><span className="eyebrow"><Sparkles size={13}/> ТВОЯ ИСТОРИЯ НАЧИНАЕТСЯ ЗДЕСЬ</span><h2>Готов найти<br/><span>свой вайб?</span></h2><p>Зайди через Telegram и создай свою анкету.</p></div><a className="register-button" href="https://t.me/iBEDatig_Bot?start=register"><span className="telegram-icon">➤</span> Открыть VIBE <ArrowRight size={18}/></a></section>
    <footer><span>vibe. © 2026</span><span><Lock size={12}/> Твоя приватность важна</span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
