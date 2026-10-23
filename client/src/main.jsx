import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Compass, UserRound, ShieldAlert, MapPin, Sparkles, ArrowRight, Lock, RefreshCw, MessageCircle, ImagePlus, PlusCircle } from 'lucide-react';
import './style.css';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const webApp = window.Telegram?.WebApp;
const initData = webApp?.initData || '';

function App() {
  const [tab, setTab] = useState('discover');
  const [user, setUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [myListing, setMyListing] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
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
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [listing, setListing] = useState({name:'',age:'',city:'',country:'',hobbies:'',description:''});
  const [publishing, setPublishing] = useState(false);
  const [banCode, setBanCode] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banResult, setBanResult] = useState(null);

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

  async function banByCode(e) {
    e.preventDefault();
    setBanResult(null);
    try {
      const data = await request('/api/admin/users/' + encodeURIComponent(banCode) + '/ban', {
        method: 'POST', body: JSON.stringify({ reason: banReason })
      });
      setBanResult('⛔ Забанен профиль ' + data.user.profile_code + ': ' + data.user.first_name);
      setBanCode('');
      setBanReason('');
    } catch (e) { setBanResult('Ошибка: ' + e.message); }
  }

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
      setNotice(result.matched ? 'У вас взаимная симпатия 💜' : 'Симпатия отправлена.');
    } catch (e) { setError(e.message); }
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
      setNotice('Анкета опубликована и отправлена в рекомендации VIBE.');
      setTab('discover');
    } catch(e) { setError(e.message||'Не удалось опубликовать анкету.'); }
    finally { setPublishing(false); }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!reportTarget || !reportReason.trim()) return;
    setReporting(true);
    setError('');
    try {
      const ticket = await request('/api/reports/' + encodeURIComponent(reportTarget.id), {
        method: 'POST',
        body: JSON.stringify({ reason: reportReason.trim(), details: reportDetails.trim() })
      });
      setNotice('Жалоба-тикет №' + ticket.reportId + ' отправлена. Администраторы получат уведомление в Telegram.');
      setReportTarget(null);
      setViewingProfile(null);
      setReportReason('');
      setReportDetails('');
    } catch (e) { setError(e.message || 'Не удалось отправить жалобу.'); }
    finally { setReporting(false); }
  }

  async function skip(person) {
    // Hiding a card is only a local action; it does not create a like.
    setPeople(current => current.filter(p => p.id !== person.id));
  }

  if (user?.account_status === 'banned') return <main className="app-shell"><section className="panel" role="alert" style={{margin:'10vh auto',maxWidth:560,textAlign:'center'}}><div className="panel-icon"><ShieldAlert/></div><h1>Ваш профиль забанен</h1><p>Доступ к VIBE закрыт.</p><p><b>Причина:</b> {user.moderation_note || user.reason || 'Причина не указана'}</p></section></main>;
  if (!initData) return <Landing />;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><span className="online"><i/> {user ? 'Telegram подключён' : 'знакомства'}</span><button className="avatar" onClick={() => setTab('profile')}>{user?.photo_url ? <img src={user.photo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/> : (user?.first_name || 'Я').slice(0, 1)}</button></header>
    <section className="hero"><div className="eyebrow"><Sparkles size={14}/> ТВОЯ ВОЛНА</div><h1>Люди, с которыми<br/><span>совпадает вайб.</span></h1><p>Настоящие анкеты пользователей VIBE — без выдуманных профилей.</p></section>
    <nav className="tabs"><button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass size={17}/> Знакомства</button><button className={tab === 'likes' ? 'active' : ''} onClick={() => setTab('likes')}><Heart size={17}/> Симпатии</button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('listing')}><PlusCircle size={17}/> Добавить анкету</button><button className={tab === 'chats' || tab === 'chat' ? 'active' : ''} onClick={() => { setTab('chats'); refreshChats(); }}><MessageCircle size={17}/> Чаты</button></nav>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    {error && <div className="notice" role="alert"><ShieldAlert size={16}/><span>{error}</span><button onClick={loadApp} title="Повторить"><RefreshCw size={15}/></button></div>}
    {loading && <div className="panel"><p>Подключаем VIBE…</p></div>}
    {!loading && tab === 'discover' && <section className="people">
      <div className="section-heading"><div><h2>Твоя подборка</h2><p>Показываем только анкеты, сохранённые в базе VIBE</p></div><span className="count">{people.length} анкет</span></div>
      {people.length === 0 && <div className="empty"><Sparkles/><h3>Пока нет доступных анкет</h3><p>Основной интерфейс открыт для просмотра. Анкеты появятся после регистрации пользователей и необходимых проверок.</p></div>}
      {people.map(p => <article className="person-card" key={p.id}>
        <div className="person-art violet">{p.photo_url ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div className="person-initial">{(p.name || '?').slice(0,1)}</div>}<span className="art-caption">VIBE / MEMBER</span></div>
        <div className="person-info"><div className="person-title"><div><h3>{p.name || 'Пользователь'}{p.age ? ', '+p.age : ''}{p.role_label && <span className="staff-rank" style={{display:'inline-flex',marginLeft:8,padding:'3px 8px',borderRadius:999,fontSize:11,fontWeight:700,verticalAlign:'middle',background:p.public_role==='developer'?'#3b235d':p.public_role==='chief_admin'?'#4a3514':'#25223a',color:p.public_role==='developer'?'#e6c7ff':p.public_role==='chief_admin'?'#ffd98a':'#d7c7ff'}}>{p.role_label}</span>}</h3><span className="location"><MapPin size={13}/>{[p.city,p.country].filter(Boolean).join(', ') || 'Местоположение не указано'}</span></div></div><p>{p.description || p.bio || 'Пока без описания.'}</p><div className="chips">{(p.interests || []).map(x => <span key={x}>{x}</span>)}</div><div className="card-actions"><button className="skip" onClick={() => setViewingProfile(p)}>Посмотреть анкету</button><button className="skip" onClick={() => skip(p)}>Пропустить</button><button className="like" onClick={() => like(p)}><Heart size={17} fill="currentColor"/> Нравится</button><button className="skip" onClick={() => { setViewingProfile(null); setReportTarget(p); setReportReason(''); setReportDetails(''); }}>Пожаловаться</button></div></div>
      </article>)}
    </section>}
    {viewingProfile && <div className="report-overlay"><section className="panel report-dialog"><button className="back-chat" onClick={() => setViewingProfile(null)}>← Назад</button><h2>{viewingProfile.name || 'Пользователь'}{viewingProfile.age ? ', ' + viewingProfile.age : ''}</h2>{viewingProfile.photo_url && <img src={viewingProfile.photo_url} alt="Фото анкеты" style={{width:'100%',maxHeight:320,objectFit:'contain',borderRadius:14,background:'#0f0d16',margin:'14px 0'}}/>}<p><b>Город:</b> {[viewingProfile.city,viewingProfile.country].filter(Boolean).join(', ') || 'Не указан'}</p><p><b>О себе:</b> {viewingProfile.description || viewingProfile.bio || 'Описание не добавлено.'}</p><p><b>Интересы:</b> {(viewingProfile.interests || []).join(', ') || 'Не указаны'}</p>{String(viewingProfile.id) !== String(user?.id) && <div className="profile-actions"><button className="like" onClick={() => { const person = viewingProfile; setViewingProfile(null); like(person); }}><Heart size={17} fill="currentColor"/> Поставить лайк</button><button className="save" onClick={() => openChat({user_id:viewingProfile.id,first_name:viewingProfile.name || 'Пользователь',photo_url:viewingProfile.photo_url})}><MessageCircle size={17}/> Написать в ЛС</button><button className="skip" onClick={() => { setReportTarget(viewingProfile); setViewingProfile(null); setReportReason(''); setReportDetails(''); }}>Подать жалобу / создать тикет</button></div>}</section></div>}
    {reportTarget && <div className="report-overlay"><section className="panel report-dialog"><button className="back-chat" onClick={() => setReportTarget(null)}>← Отмена</button><h2>Пожаловаться на {reportTarget.name || 'пользователя'}</h2><p>Жалоба попадёт администраторам VIBE для проверки.</p><form onSubmit={submitReport}><label>Причина<select value={reportReason} onChange={e => setReportReason(e.target.value)} required><option value="">Выбери причину</option><option value="Спам">Спам</option><option value="Оскорбления или угрозы">Оскорбления или угрозы</option><option value="Фейковая анкета">Фейковая анкета</option><option value="Неприемлемый контент">Неприемлемый контент</option><option value="Подозрение на мошенничество">Подозрение на мошенничество</option><option value="Другое">Другое</option></select></label><label>Подробности (необязательно)<textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} maxLength={1000} placeholder="Опиши, что произошло"/></label><button className="save" type="submit" disabled={reporting}>{reporting ? 'Отправляем…' : 'Отправить жалобу'}</button></form></section></div>}
    {!loading && user?.admin_access && <section className="panel"><div className="panel-icon"><ShieldAlert/></div><h2>Модерация: бан по коду</h2><p>Код из карточки пользователя в боте — ровно 6 цифр.</p><form onSubmit={banByCode}><label>Код профиля<input value={banCode} onChange={e=>setBanCode(e.target.value.replace(/\\D/g,'').slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="001234" required/></label><label>Причина бана<textarea value={banReason} onChange={e=>setBanReason(e.target.value)} maxLength={500} required placeholder="Причина бана"/></label><button className="save" type="submit">Забанить профиль</button></form>{banResult && <p role="status">{banResult}</p>}</section>}
    {!loading && tab === 'likes' && <section className="panel"><div className="panel-icon"><Heart/></div><h2>Симпатии</h2><p>Когда симпатия взаимная, здесь можно начать переписку через раздел «Чаты».</p><button className="save" onClick={() => { setTab('chats'); refreshChats(); }}>Открыть чаты <MessageCircle size={16}/></button></section>}
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
    {!loading && tab === 'profile' && <><section className="panel profile-panel"><div className="panel-icon"><UserRound/></div><h2>Твой профиль</h2><p>Профиль сохраняется в базе данных и привязывается к твоему Telegram.</p>{myListing ? <div className="own-listing-preview"><h3>Твоя публичная анкета</h3><p><b>{myListing.name}</b>{myListing.age ? ', ' + myListing.age : ''} · {[myListing.city,myListing.country].filter(Boolean).join(', ')}</p><p>{myListing.description || 'Описание не добавлено.'}</p><p><b>Хобби:</b> {myListing.hobbies || 'Не указаны'}</p><button className="skip" type="button" onClick={() => setViewingProfile({...myListing,id:user?.id,photo_url:user?.photo_url,interests:(myListing.hobbies||'').split(',').map(x=>x.trim()).filter(Boolean)})}>Посмотреть свою анкету</button><button className="skip" type="button" onClick={() => setTab('listing')}>Редактировать анкету</button></div> : <div className="own-listing-preview"><h3>Публичной анкеты пока нет</h3><p>Создай отдельную анкету, чтобы её можно было посмотреть в этом разделе.</p><button className="save" type="button" onClick={() => setTab('listing')}>Создать анкету</button></div>}
      <form onSubmit={saveProfile}>
        <label>Имя в Telegram<input value={user?.first_name || ''} readOnly/></label>
        <label>Username Telegram<input value={user?.username ? '@' + user.username : 'Не указан'} readOnly/></label>
        <label>Дата рождения<input type="date" value={profile.birthDate} max={new Date().toISOString().slice(0,10)} onChange={e => setProfile({...profile,birthDate:e.target.value})} required/></label>
        <label>Пол (необязательно)<select value={profile.gender} onChange={e => setProfile({...profile,gender:e.target.value})}><option value="">Не указывать</option><option value="woman">Женщина</option><option value="man">Мужчина</option><option value="nonbinary">Небинарный человек</option><option value="prefer_not_to_say">Предпочитаю не отвечать</option></select></label>
        <label>Город<input value={profile.city} onChange={e => setProfile({...profile,city:e.target.value})} maxLength={100} placeholder="Например, Берлин"/></label>
        <label>О себе<textarea value={profile.bio} onChange={e => setProfile({...profile,bio:e.target.value})} maxLength={500} placeholder="Расскажи о себе"/></label>
        <label>Фото анкеты
          {profile.photoUrl && <img src={profile.photoUrl} alt="Предпросмотр фото анкеты" style={{width:'100%',maxHeight:280,objectFit:'contain',borderRadius:14,background:'#0f0d16'}}/>}
          <span className="media-picker"><ImagePlus size={17}/>{uploadingMedia ? 'Читаем файл…' : 'Выбрать фото из галереи'}<input type="file" accept="image/*" onChange={chooseMedia} disabled={uploadingMedia}/></span>
          <small className="field-hint">JPG, PNG, WebP и другие изображения. До 3 МБ.</small>
          <input type="url" value={profile.photoUrl.startsWith('data:') ? '' : profile.photoUrl} onChange={e => setProfile({...profile,photoUrl:e.target.value})} placeholder="Или вставь ссылку https://..."/>
        </label>
        <label>Цель знакомства<select value={profile.goal} onChange={e => setProfile({...profile,goal:e.target.value})}><option value="friendship">Дружба</option><option value="chat">Общение</option><option value="relationship">Отношения</option><option value="both">Посмотрим, как пойдёт</option></select></label>
        <label>Интересы через запятую<input value={profile.interests} onChange={e => setProfile({...profile,interests:e.target.value})} placeholder="Музыка, кино, прогулки"/></label>
        {ageStatus && <p>Статус проверки возраста: <b>{({unverified:'не подтверждён',pending:'на проверке',verified:'подтверждён',rejected:'отклонён',manual_review:'нужна дополнительная проверка'})[ageStatus.status] || 'неизвестен'}</b></p>}
        <button className="save" type="submit" disabled={saving || uploadingMedia}><PlusCircle size={16}/>{saving ? 'Сохраняем…' : (user?.bio || user?.photo_url || user?.city ? 'Сохранить анкету' : 'Создать анкету')} <ArrowRight size={16}/></button>
      </form>
    </section></>}
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
      <article><span className="feature-icon"><ShieldAlert/></span><h2>Безопасность важна</h2><p>Доступ к знакомствам для взрослых открывается только после проверки возраста.</p></article>
    </section>
    <footer><span>vibe. © 2026</span><span><Lock size={12}/> Безопасность важна</span></footer>
  </main>;
}

function AdminLink() {
  return <main className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><a href="/">← В приложение</a></header><section className="panel"><div className="panel-icon"><ShieldAlert/></div><h1>VIBE Admin</h1><p>Панель модерации доступна только авторизованным администраторам Telegram. Открой её из Mini App.</p><a className="save" href="https://github.com/s00222404-prog/-">Открыть репозиторий <ArrowRight size={16}/></a></section></main>;
}

createRoot(document.getElementById('root')).render(<App/>);
