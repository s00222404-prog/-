import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Compass, UserRound, ShieldAlert, MapPin, Sparkles, ArrowRight, Lock, RefreshCw, MessageCircle, ImagePlus, PlusCircle, BadgeCheck, Crown, ShieldCheck, Wrench } from 'lucide-react';
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
  const [user, setUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [likesData, setLikesData] = useState({incoming:[],outgoing:[]});
  const [myListing, setMyListing] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reportingPerson, setReportingPerson] = useState(null);
  const [reportReason, setReportReason] = useState('Спам');
  const [reportDetails, setReportDetails] = useState('');
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
      if (mine.listing) setListing({name:mine.listing.name,age:String(mine.listing.age),city:mine.listing.city,country:mine.listing.country,hobbies:mine.listing.hobbies||'',description:mine.listing.description||''});
      const chatData = await request('/api/chats');
      setChats(chatData.chats || []);
      const likes = await request('/api/likes').catch(() => ({incoming:[],outgoing:[]}));
      setLikesData({incoming:likes.incoming||[],outgoing:likes.outgoing||[]});
    } catch (e) {
      if (e.banned) {
        setUser({ account_status: 'banned', moderation_note: e.banReason });
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
      setError('Пока можно загрузить фото или изображение из галереи. Видео добавим отдельно.');
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
    setReportSubmitting(true); setError('');
    try {
      await request('/api/reports/' + encodeURIComponent(reportingPerson.id), { method:'POST', body:JSON.stringify({reason:reportReason,details:reportDetails}) });
      setReportingPerson(null); setReportDetails('');
      setNotice('Жалоба отправлена уполномоченным специалистам. Спасибо за сигнал.');
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
      const result=await request('/api/listings',{method:'POST',body:JSON.stringify({...listing,age:Number(listing.age)})});
      const savedListing={...result.listing,age:String(result.listing.age)};
      setListing(savedListing);
      setMyListing(savedListing);
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

  if (user?.account_status === 'banned') return <main className="app-shell"><section className="panel" role="alert" style={{margin:'10vh auto',maxWidth:560,textAlign:'center'}}><div className="panel-icon"><ShieldAlert/></div><h1>Ваш профиль забанен</h1><p>Доступ к VIBE закрыт.</p><p><b>Причина:</b> {user.moderation_note || user.reason || 'Причина не указана'}</p></section></main>;
  if (!initData) return <Landing />;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><span className="online"><i/> {user ? 'Telegram подключён' : 'знакомства'}</span><button className="avatar" aria-label="Открыть мой профиль" onClick={() => setProfileOpen(true)}>{user?.photo_url ? <img src={user.photo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/> : (user?.first_name || 'Я').slice(0, 1)}</button></header>
    <section className="hero"><div className="eyebrow"><Sparkles size={14}/> ТВОЯ ВОЛНА</div><h1>Люди, с которыми<br/><span>совпадает вайб.</span></h1><p>Настоящие анкеты пользователей VIBE — без выдуманных профилей.</p></section>
    <nav className="tabs"><button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass size={17}/> Знакомства</button><button className={tab === 'likes' ? 'active' : ''} onClick={async () => { setTab('likes'); try { const data = await request('/api/likes'); setLikesData({incoming:data.incoming||[],outgoing:data.outgoing||[]}); } catch(e) { setError(e.message); } }}><Heart size={17}/> Симпатии <span className="tab-count">{likesData.incoming.length}</span></button><button className={tab === 'listing' ? 'active' : ''} onClick={() => { setProfileOpen(false); setTab('listing'); }}><PlusCircle size={17}/> Моя анкета</button><button className={tab === 'chats' || tab === 'chat' ? 'active' : ''} onClick={() => { setTab('chats'); refreshChats(); }}><MessageCircle size={17}/> Чаты <span className="tab-count">{chats.length}</span></button></nav>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    {error && <div className="notice" role="alert"><ShieldAlert size={16}/><span>{error}</span><button onClick={loadApp} title="Повторить"><RefreshCw size={15}/></button></div>}
    {loading && <div className="panel"><p>Подключаем VIBE…</p></div>}
    {!loading && tab === 'discover' && <section className="people">
      <div className="section-heading"><div><h2>Для тебя</h2><p>Подборка автоматически учитывает твой профиль, интересы, город и цель знакомства</p></div><span className="count">{people.length} анкет</span></div>
      {people.length === 0 && <div className="empty"><Sparkles/><h3>Пока нет доступных анкет</h3><p>Основной интерфейс открыт для просмотра. Анкеты появятся по мере регистрации пользователей.</p></div>}
      {people.map(p => <article className="profile-card" key={p.id}>
        <div className="profile-cover">
          {p.photo_url ? <img className="profile-cover-image" src={p.photo_url} alt={'Фото: ' + (p.name || 'пользователь')}/> : <div className="profile-cover-placeholder"><span>{(p.name || '?').slice(0,1).toUpperCase()}</span><small>ТВОЙ ВАЙБ. ТВОЯ ИСТОРИЯ.</small></div>}
          <span className="profile-cover-label"><Sparkles size={13}/> VIBE</span>
          {String(p.id) !== String(user?.id) && <button className="profile-report" aria-label="Пожаловаться на анкету" title="Пожаловаться" onClick={() => { setReportingPerson(p); setReportReason('Спам'); setReportDetails(''); }}><ShieldAlert size={18}/></button>}
          {p.status === 'pending' && <span className="profile-status">На проверке</span>}
          {p.status === 'rejected' && <span className="profile-status rejected">Отклонена</span>}
          <div className="profile-cover-gradient"/>
          <div className="profile-cover-heading"><h3>{p.name || 'Пользователь'}{p.age ? <span>, {p.age}</span> : ''}</h3><RoleBadge role={p.public_role} label={p.role_label}/><span className="profile-location"><MapPin size={14}/>{[p.city,p.country].filter(Boolean).join(', ') || 'Местоположение не указано'}</span></div>
        </div>
        <div className="profile-card-body">
          <p className="profile-bio">{p.description || p.bio || 'Пока ничего не рассказал о себе.'}</p>
          {(p.interests || []).length > 0 && <div className="profile-interests">{(p.interests || []).slice(0,8).map(x => <span key={x}>#{x}</span>)}</div>}
          {String(p.id) === String(user?.id) ? <button className="profile-edit-cta" onClick={() => setProfileOpen(true)}><UserRound size={17}/> Это твоя анкета · профиль</button> : <div className="profile-actions-bar">
            <button className="profile-action profile-skip" aria-label="Пропустить анкету" title="Пропустить" onClick={() => skip(p)}><ArrowRight size={19}/><span>Пропустить</span></button>
            <button className="profile-action profile-like" onClick={() => like(p)}><Heart size={20} fill="currentColor"/><span>Лайк</span></button>
            <button className="profile-action profile-chat" onClick={() => openChat({user_id:p.id,first_name:p.name || 'Пользователь',photo_url:p.photo_url})}><MessageCircle size={19}/><span>Написать</span></button>
          </div>}
          {String(p.id) !== String(user?.id) && <button className="profile-details-link" onClick={() => setViewingProfile(p)}>Подробнее об анкете <ArrowRight size={15}/></button>}
        </div>
      </article>)}
    </section>}
    {viewingProfile && <div className="report-overlay"><section className="panel report-dialog"><button className="back-chat" onClick={() => setViewingProfile(null)}>← Назад</button><h2>{viewingProfile.name || 'Пользователь'}{viewingProfile.age ? ', ' + viewingProfile.age : ''}</h2><RoleBadge role={viewingProfile.public_role} label={viewingProfile.role_label}/>{viewingProfile.photo_url && <img src={viewingProfile.photo_url} alt="Фото анкеты" style={{width:'100%',maxHeight:320,objectFit:'contain',borderRadius:14,background:'#0f0d16',margin:'14px 0'}}/>}<p><b>Город:</b> {[viewingProfile.city,viewingProfile.country].filter(Boolean).join(', ') || 'Не указан'}</p><p><b>О себе:</b> {viewingProfile.description || viewingProfile.bio || 'Описание не добавлено.'}</p><p><b>Интересы:</b> {(viewingProfile.interests || []).join(', ') || 'Не указаны'}</p>{String(viewingProfile.id) !== String(user?.id) && <div className="profile-actions"><button className="like" onClick={() => { const person = viewingProfile; setViewingProfile(null); like(person); }}><Heart size={17} fill="currentColor"/> Поставить лайк</button><button className="save" onClick={() => openChat({user_id:viewingProfile.id,first_name:viewingProfile.name || 'Пользователь',photo_url:viewingProfile.photo_url})}><MessageCircle size={17}/> Написать в ЛС</button><button className="skip" onClick={() => { setReportingPerson(viewingProfile); setReportReason('Спам'); setReportDetails(''); setViewingProfile(null); }}>Пожаловаться</button></div>}</section></div>}


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
    {!loading && tab === 'chats' && <section className="panel"><div className="panel-icon"><MessageCircle/></div><h2>Твои чаты</h2><p>Переписка доступна после взаимного лайка.</p>{chats.length === 0 ? <div className="empty"><Heart/><h3>Пока нет чатов</h3><p>Ставь лайки анкетам — чат появится, когда симпатия станет взаимной.</p></div> : chats.map(chat => <button className="chat-row" key={chat.user_id} onClick={() => openChat(chat)}><span className="chat-avatar">{(chat.first_name || '?').slice(0,1)}</span><span className="chat-row-copy"><b>{chat.first_name}</b><small>{chat.last_message || 'Начни разговор 👋'}</small></span><MessageCircle size={18}/></button>)}</section>}
    {!loading && tab === 'chat' && activeChat && <section className="panel chat-panel"><button className="back-chat" onClick={() => { setTab('chats'); refreshChats(); }}>← Все чаты</button><h2>Чат с {activeChat.first_name}</h2><div className="messages-list">{messages.map(message => <div className={'message-bubble ' + (String(message.sender_id) === String(user?.id) ? 'mine' : '')} key={message.id}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}</div><form className="chat-compose" onSubmit={sendMessage}><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} placeholder="Напиши сообщение…" required/><button className="like" type="submit"><ArrowRight size={17}/></button></form></section>}
    {!loading && tab === 'listing' && <section className="panel profile-panel"><div className="panel-icon"><PlusCircle/></div><h2>Добавить анкету</h2><p>Это отдельная публичная анкета для рекомендаций. Она не меняет данные твоего профиля Telegram.</p><form onSubmit={publishListing}>
      <label>Имя<input value={listing.name} onChange={e=>setListing({...listing,name:e.target.value})} minLength={2} maxLength={60} placeholder="Как тебя показывать" required/></label>
      <label>Возраст (числом)<input type="number" inputMode="numeric" min="18" max="100" step="1" value={listing.age} onChange={e=>setListing({...listing,age:e.target.value})} placeholder="Например, 22" required/></label>
      <label>Город<input value={listing.city} onChange={e=>setListing({...listing,city:e.target.value})} minLength={2} maxLength={80} placeholder="Например, Берлин" required/></label>
      <label>Страна<input value={listing.country} onChange={e=>setListing({...listing,country:e.target.value})} minLength={2} maxLength={80} placeholder="Например, Германия" required/></label>
      <label>Хобби и занятия<textarea value={listing.hobbies} onChange={e=>setListing({...listing,hobbies:e.target.value})} maxLength={300} placeholder="Музыка, спорт, игры, прогулки…"/></label>
      <label>Описание<textarea value={listing.description} onChange={e=>setListing({...listing,description:e.target.value})} maxLength={1000} placeholder="Расскажи о себе без мата и пошлостей" required/></label>
      <p className="field-hint">Перед публикацией проверяем текст на ругательства и пошлые выражения. Возраст анкеты должен быть 18+.</p>
      <button className="save" type="submit" disabled={publishing}><PlusCircle size={16}/>{publishing?'Публикуем…':'Опубликовать анкету'}<ArrowRight size={16}/></button>
    </form></section>}
    {profileOpen && <div className="report-overlay" onClick={e => { if (e.target === e.currentTarget) setProfileOpen(false); }}><section className="panel report-dialog profile-modal account-profile-modal"><button className="back-chat" type="button" onClick={() => setProfileOpen(false)}>← Закрыть профиль</button><div className="account-avatar">{user?.photo_url ? <img src={user.photo_url} alt="Аватар" /> : <UserRound size={42}/>}</div><h2>{user?.username ? '@' + user.username : (user?.first_name || 'Пользователь')}</h2><RoleBadge role={user?.public_role} label={user?.role_label}/><div className="account-profile-stats"><div><span>Код аккаунта</span><strong>{user?.account_code || String(user?.id || '').padStart(6,'0')}</strong></div><div><span>Симпатии</span><strong><Heart size={17} fill="currentColor"/> {user?.likes_received || 0}</strong></div></div></section></div>}
    {reportingPerson && <div className="report-overlay"><section className="panel report-dialog"><button className="back-chat" type="button" onClick={() => setReportingPerson(null)}>← Назад</button><h2>Пожаловаться на анкету</h2><p>Жалоба попадёт уполномоченным специалистам в Telegram-бот. Пользователь не увидит, кто отправил жалобу.</p><form onSubmit={submitReport}><label>Причина<select value={reportReason} onChange={e=>setReportReason(e.target.value)}><option>Спам</option><option>Оскорбления или угрозы</option><option>Фейковая анкета</option><option>Неприемлемый контент</option><option>Подозрение на мошенничество</option><option>Другое</option></select></label><label>Подробности<textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} maxLength={1000} placeholder="Что именно случилось?"/></label><button className="save" type="submit" disabled={reportSubmitting}>{reportSubmitting?'Отправляем…':'Отправить жалобу'}</button></form></section></div>}
    <footer><span>vibe. © 2026</span><span><Lock size={12}/> Безопасность важна</span></footer>
  </main>;
}


function Landing() {
  return <main className="app-shell landing-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div>
      <a className="landing-menu" href="#about">О VIBE</a>
    </header>
    <section className="landing-hero">
      <div className="eyebrow"><Sparkles size={14}/> ТВОЯ ВОЛНА</div>
      <div className="landing-orb"><div className="orb-core">v<span>.</span></div><span className="orb-dot orb-dot-one">✦</span><span className="orb-dot orb-dot-two">♡</span><span className="orb-dot orb-dot-three">✧</span></div>
      <h1>Твой человек.<br/><span>Твой вайб.</span></h1>
      <p>Знакомься с людьми, с которыми легко быть собой. Начни с Telegram — это быстро и без лишних паролей.</p>
      <a className="register-button" href="https://t.me/iBEDatig_Bot?start=register"><span className="telegram-icon">➤</span> Зарегистрироваться через Telegram <ArrowRight size={18}/></a>
      <div className="landing-trust"><span><Lock size={14}/> Вход через Telegram</span><span><Sparkles size={14}/> Твой профиль — твой вайб</span></div>
    </section>
    <section className="landing-features" id="about">
      <article><span className="feature-icon"><Heart/></span><h2>Настоящие люди</h2><p>Показываем анкеты реальных пользователей, без выдуманных профилей.</p></article>
      <article><span className="feature-icon"><UserRound/></span><h2>Профиль за минуту</h2><p>Имя и username Telegram привяжутся к профилю автоматически.</p></article>
      <article><span className="feature-icon"><ShieldAlert/></span><h2>Безопасность важна</h2><p>Комфортное пространство для новых знакомств.</p></article>
    </section>
    <footer><span>vibe. © 2026</span><span><Lock size={12}/> Безопасность важна</span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
