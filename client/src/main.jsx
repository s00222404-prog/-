import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Compass, UserRound, ShieldAlert, MapPin, Sparkles, ArrowRight, Lock, RefreshCw, MessageCircle, ImagePlus, PlusCircle, BadgeCheck, Crown, ShieldCheck, Wrench, LayoutGrid, Rows3, Flag } from 'lucide-react';
import './style.css';
import { translationAttributeOriginals, translationOriginals, translateUiText } from './i18n.js';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const webApp = window.Telegram?.WebApp;
const initData = webApp?.initData || '';


const LANGUAGES = {
  en: {label:'English', flag:'🇬🇧'},
  de: {label:'Deutsch', flag:'🇩🇪'},
  ru: {label:'Русский', flag:'🇷🇺'}
};
function getStoredLanguage() {
  try {
    const saved = localStorage.getItem('vibe-language');
    return saved && Object.prototype.hasOwnProperty.call(LANGUAGES, saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}

function LanguagePicker({className=''}) {
  const [language,setLanguage] = useState(getStoredLanguage);
  function changeLanguage(value) {
    setLanguage(value);
    if (!Object.prototype.hasOwnProperty.call(LANGUAGES, value)) return;
    try { localStorage.setItem('vibe-language', value); } catch {}
    document.documentElement.lang = value;
    window.dispatchEvent(new CustomEvent('vibe-language-change',{detail:value}));
  }
  return <label className={'language-picker '+className} aria-label="Choose language"><span aria-hidden="true">{LANGUAGES[language].flag}</span><select value={language} onChange={e=>changeLanguage(e.target.value)} aria-label="Language"><option value="en">English</option><option value="de">Deutsch</option><option value="ru">Русский</option></select></label>;
}

function RoleBadge({ role, label }) {
  if (!label || !role || role === 'none') return null;
  const Icon = role === 'developer' || role === 'chief_admin' ? Crown : role === 'admin' ? ShieldCheck : role === 'moderator' ? BadgeCheck : Wrench;
  return <span className={'role-badge role-' + role}><span className="role-badge-icon"><Icon size={13} strokeWidth={2.6}/></span><span>{label}</span><span className="role-badge-glint" aria-hidden="true"/></span>;
}

function App() {
  const [language, setLanguage] = useState(getStoredLanguage);
  useEffect(() => {
    const updateLanguage = event => setLanguage(event.detail || 'en');
    window.addEventListener('vibe-language-change', updateLanguage);
    document.documentElement.lang = language;
    const root = document.querySelector('.app-shell');
    if (root) {
      const translate = () => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
          if (!node.parentElement?.closest('script,style,textarea,input')) {
            if (!translationOriginals.has(node)) translationOriginals.set(node, node.nodeValue);
            const original = translationOriginals.get(node);
            const translated = translateUiText(original, language);
            if (node.nodeValue !== translated) node.nodeValue = translated;
          }
        });
        root.querySelectorAll('input[placeholder],textarea[placeholder],[aria-label],[title]').forEach(el => {
          let originals = translationAttributeOriginals.get(el);
          if (!originals) { originals = {}; translationAttributeOriginals.set(el, originals); }
          for (const attr of ['placeholder','aria-label','title']) {
            const value = el.getAttribute(attr);
            if (value && !(attr in originals)) originals[attr] = value;
            if (originals[attr]) {
              const translated = translateUiText(originals[attr], language);
              if (el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
            }
          }
        });
        root.querySelectorAll('option').forEach(el => {
          if (!translationOriginals.has(el.firstChild || el)) translationOriginals.set(el.firstChild || el, el.textContent);
          const original = translationOriginals.get(el.firstChild || el);
          if (original != null && el.textContent !== translateUiText(original, language)) el.textContent = translateUiText(original, language);
        });
      };
      translate();
      const observer = new MutationObserver(translate);
      observer.observe(root, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
      return () => { observer.disconnect(); window.removeEventListener('vibe-language-change', updateLanguage); };
    }
    return () => window.removeEventListener('vibe-language-change', updateLanguage);
  }, [language]);
  const [tab, setTab] = useState('discover');
  const [user, setUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [likesData, setLikesData] = useState({incoming:[],outgoing:[]});
  const [mutualIds, setMutualIds] = useState([]);
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
  const [feedSearch, setFeedSearch] = useState('');
  const [feedCity, setFeedCity] = useState('all');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [listingMediaUrl, setListingMediaUrl] = useState('');
  const [listingMediaType, setListingMediaType] = useState('image');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [profile, setProfile] = useState({ birthDate: '', gender: '', bio: '', city: '', photoUrl: '', goal: 'both', interests: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(null);
  const [saving, setSaving] = useState(false);
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
      if (!u.birth_date) setProfileOpen(true);
      setProfile({
        birthDate: u.birth_date ? String(u.birth_date).slice(0, 10) : '',
        gender: u.gender || '',
        bio: u.bio || '',
        city: u.city || '',
        photoUrl: u.photo_url || '',
        goal: u.goal || 'both',
        interests: Array.isArray(u.interests) ? u.interests.join(', ') : ''
      });
      const discovery = await request('/api/discover');
      setPeople(discovery.people || []);
      const mine = await request('/api/listings/mine').catch(() => ({listing:null}));
      if (mine.listing) { setListing({name:mine.listing.name,age:String(mine.listing.age),city:mine.listing.city,country:mine.listing.country,hobbies:mine.listing.hobbies||'',description:mine.listing.description||''}); setListingMediaUrl(mine.listing.media_url||''); setListingMediaType(mine.listing.media_type||'image'); }
      const chatData = await request('/api/chats');
      setChats(chatData.chats || []);
      const likes = await request('/api/likes').catch(() => ({incoming:[],outgoing:[]}));
      const incomingLikes = likes.incoming || [];
      const outgoingLikes = likes.outgoing || [];
      setLikesData({incoming:incomingLikes,outgoing:outgoingLikes});
      setMutualIds(incomingLikes.filter(person => outgoingLikes.some(other => String(other.id) === String(person.id))).map(person => String(person.id)));
    } catch (e) {
      if (e.banned) {
        setUser({ account_status: 'banned', moderation_note: e.banReason, ban_issuer_label: e.banIssuer });
        setError('');
      } else setError(e.message || 'Не удалось подключиться к VIBE API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetch(API+'/api/service-status').then(r=>r.json()).then(s=>{if(s.maintenance)setMaintenance(s);else if(initData)loadApp();else setLoading(false)}).catch(()=>{if(initData)loadApp();else setLoading(false)}); }, []);

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
      if (!profile.birthDate) { setError('Укажи дату рождения, чтобы создать профиль и пользоваться VIBE.'); setSaving(false); return; }
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
      const discovery = await request('/api/discover');
      setPeople(discovery.people || []);
      setNotice('Профиль сохранён.');
      setProfileOpen(false);
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
      if (result.matched) setMutualIds(current => current.includes(String(person.id)) ? current : [...current, String(person.id)]);
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
    const body = draft.trim();
    if (!activeChat || !body || sendingMessage) return;
    setSendingMessage(true);
    setError('');
    try {
      const data = await request('/api/chats/' + encodeURIComponent(activeChat.user_id) + '/messages', {
        method: 'POST', body: JSON.stringify({ body })
      });
      if (data.message) setMessages(current => [...current, data.message]);
      setDraft('');
    } catch (e) {
      setError(e.message || 'Не удалось отправить сообщение.');
    } finally {
      setSendingMessage(false);
    }
  }

  async function publishListing(e) {
    e.preventDefault();
    setPublishing(true); setError(''); setNotice('');
    try {
      if (!user?.birth_date) { setProfileOpen(true); throw new Error('Сначала заполни профиль и укажи дату рождения.'); }
      const result=await request('/api/listings',{method:'POST',body:JSON.stringify({...listing,age:Number(listing.age),mediaUrl:listingMediaUrl||null,mediaType:listingMediaType})});
      const savedListing={...result.listing,age:String(result.listing.age)};
      setListing(savedListing);
      setListingMediaUrl(savedListing.media_url || ''); setListingMediaType(savedListing.media_type || 'image');
      const discovery=await request('/api/discover'); setPeople(discovery.people||[]);
      setNotice('Анкета сохранена и отправлена на проверку. Она станет видна другим после одобрения. Ты можешь видеть свою анкету в рекомендациях.');
      setTab('discover');
    } catch(e) { setError(e.message||'Не удалось опубликовать анкету.'); }
    finally { setPublishing(false); }
  }

  async function skip(person) {
    // Hiding a card is only a local action; it does not create a like.
    setPeople(current => current.filter(p => String(p.id) !== String(person.id)));
  }

  const isMutualMatch = personId => mutualIds.includes(String(personId));

  const normalizedFeedSearch = feedSearch.trim().toLocaleLowerCase();
  const cityOptions = [...new Set(people.map(person => person.city).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filteredPeople = people.filter(person => {
    const searchable = [person.name, person.username, person.city, person.country, person.description, person.bio, ...(person.interests || [])]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    const matchesSearch = !normalizedFeedSearch || searchable.includes(normalizedFeedSearch);
    const matchesCity = feedCity === 'all' || person.city === feedCity;
    return matchesSearch && matchesCity;
  });

  if (maintenance) return <main className="app-shell"><section className="panel" style={{margin:'10vh auto',maxWidth:560,textAlign:'center',padding:28}}><div style={{fontSize:48}}>🔒</div><h1>VIBE временно закрыт</h1><p style={{whiteSpace:'pre-wrap',lineHeight:1.6}}>{maintenance.reason || 'Проект временно недоступен.'}</p><p>Пожалуйста, попробуйте зайти позже.</p></section></main>;
  if (user?.account_status === 'banned') return <main className={tab === 'discover' ? 'app-shell feed-mode' : 'app-shell'}><section className="panel" role="alert" style={{margin:'10vh auto',maxWidth:560,textAlign:'center'}}><div className="panel-icon"><ShieldAlert/></div><h1>Ваш аккаунт забанен</h1><p>Доступ к VIBE закрыт.</p><p><b>Кем заблокирован:</b> {user.ban_issuer_label || (user.ban_issuer === 'developer' ? 'разработчиком' : 'модератором')}</p><p><b>Причина:</b> {user.moderation_note || user.reason || 'Причина не указана'}</p></section></main>;
  if (!initData) return <Landing />;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><span className="online"><i/> {user ? 'Telegram подключён' : 'знакомства'}</span><LanguagePicker/><button className="avatar" aria-label="Открыть мой профиль" onClick={() => setProfileOpen(true)}>{user?.photo_url ? <img src={user.photo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/> : (user?.first_name || 'Я').slice(0, 1)}</button></header>
    <section className="hero"><div className="eyebrow"><Sparkles size={14}/> ТВОЯ ВОЛНА</div><h1>Люди, с которыми<br/><span>совпадает вайб.</span></h1><p>Настоящие анкеты пользователей VIBE — без выдуманных профилей.</p></section>
    <nav className="tabs"><button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass size={17}/> Знакомства</button><button className={tab === 'likes' ? 'active' : ''} onClick={async () => { setTab('likes'); try { const data = await request('/api/likes'); const incomingLikes = data.incoming || []; const outgoingLikes = data.outgoing || []; setLikesData({incoming:incomingLikes,outgoing:outgoingLikes}); setMutualIds(incomingLikes.filter(person => outgoingLikes.some(other => String(other.id) === String(person.id))).map(person => String(person.id))); } catch(e) { setError(e.message); } }}><Heart size={17}/> Симпатии <span className="tab-count">{likesData.incoming.length}</span></button><button className={tab === 'listing' ? 'active' : ''} onClick={() => { setProfileOpen(false); setTab('listing'); }}><PlusCircle size={17}/> Моя анкета</button><button className={tab === 'chats' || tab === 'chat' ? 'active' : ''} onClick={() => { setTab('chats'); refreshChats(); }}><MessageCircle size={17}/> Чаты <span className="tab-count">{chats.length}</span></button></nav>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    {error && <div className="notice" role="alert"><ShieldAlert size={16}/><span>{error}</span><button onClick={loadApp} title="Повторить"><RefreshCw size={15}/></button></div>}
    {loading && <div className="panel"><p>Подключаем VIBE…</p></div>}
    {!loading && tab === 'discover' && <section className="people tiktok-feed">
      <div className="feed-topline"><div><span className="feed-kicker"><Sparkles size={13}/> VIBE FEED</span><h2>Лента для тебя</h2><p>Найди людей по интересам или городу.</p></div><span className="count">{filteredPeople.length} / {people.length}</span></div>
      <div className="feed-tools" role="search">
        <label className="feed-search"><Compass size={17} aria-hidden="true"/><input value={feedSearch} onChange={e=>setFeedSearch(e.target.value)} placeholder="Поиск по имени, интересам или описанию" aria-label="Поиск по анкетам"/></label>
        <label className="feed-city-filter"><MapPin size={16} aria-hidden="true"/><select value={feedCity} onChange={e=>setFeedCity(e.target.value)} aria-label="Фильтр по городу"><option value="all">Все города</option>{cityOptions.map(city=><option key={city} value={city}>{city}</option>)}</select></label>
        {(feedSearch || feedCity !== 'all') && <button type="button" className="feed-reset" onClick={()=>{setFeedSearch('');setFeedCity('all');}}>Сбросить</button>}
      </div>
      {people.length === 0 && <div className="empty"><Sparkles/><h3>Лента пока пуста</h3><p>Публикации появятся, когда пользователи добавят фото или видео и их анкеты будут одобрены.</p><button className="save" onClick={() => setTab('listing')}><PlusCircle size={16}/> Добавить публикацию</button></div>}
      {people.length > 0 && filteredPeople.length === 0 && <div className="empty feed-no-results"><Compass/><h3>Ничего не найдено</h3><p>Попробуй изменить поисковый запрос или выбрать другой город.</p><button className="skip" onClick={()=>{setFeedSearch('');setFeedCity('all');}}>Сбросить фильтры</button></div>}
      {filteredPeople.length > 0 && <div className="feed-scroll" >
      {filteredPeople.map((p,i) => <article className="feed-post" key={p.id} data-index={i}>
        <div className="feed-media">
          {(p.media_type === 'video' && p.media_url) ? <video className="feed-media-asset" src={p.media_url} controls playsInline loop muted preload="metadata"/> :
            (p.media_url || p.photo_url) ? <img className="feed-media-asset" src={p.media_url || p.photo_url} alt={'Публикация: ' + (p.name || 'пользователь')}/> :
            <div className="profile-cover-placeholder feed-placeholder"><span>{(p.name || '?').slice(0,1).toUpperCase()}</span><small>ТВОЙ ВАЙБ. ТВОЯ ИСТОРИЯ.</small></div>}
          <div className="feed-media-shade"/>
          <div className="feed-profile-copy"><button className="feed-name" onClick={()=>setViewingProfile(p)}>{p.name || 'Пользователь'}{p.age ? ', '+p.age : ''}</button><RoleBadge role={p.public_role} label={p.role_label}/><span className="profile-location"><MapPin size={13}/>{[p.city,p.country].filter(Boolean).join(', ') || 'Местоположение не указано'}</span><p>{p.description || p.bio || 'Пока ничего не рассказал о себе.'}</p>{(p.interests || []).length>0 && <div className="profile-interests">{p.interests.slice(0,5).map(x=><span key={x}>#{x}</span>)}</div>}</div>
          <div className="feed-action-rail">
            {String(p.id)!==String(user?.id) && <><button onClick={()=>like(p)} aria-label="Поставить лайк" title="Лайк"><Heart size={25} fill="currentColor"/><span>Лайк</span></button>{isMutualMatch(p.id) ? <button onClick={()=>openChat({user_id:p.id,first_name:p.name||'Пользователь',photo_url:p.photo_url})} aria-label="Написать в личные сообщения" title="Написать"><MessageCircle size={24}/><span>ЛС</span></button> : <button disabled aria-label="Чат доступен после взаимной симпатии" title="Чат откроется после взаимной симпатии"><Lock size={22}/><span>После матча</span></button>}<button onClick={()=>{setReportingPerson(p);setReportType('post');setReportReason('');setReportDetails('');setReporterUsername(user?.username?'@'+user.username:'');setReportedUsername(p.username?'@'+p.username:'');setReportEvidence('');setReportEvidenceName('');}} aria-label="Пожаловаться на публикацию" title="Пожаловаться"><Flag size={23}/><span>Жалоба</span></button></>}
          </div>
        </div>
        <div className="feed-post-footer"><span>@{(p.username || p.name || 'vibe').replace(/^@/,'')}</span><button onClick={()=>setViewingProfile(p)}>Профиль <ArrowRight size={14}/></button><span>{i+1} / {people.length}</span></div>
      </article>)}
      </div>}
    </section>}
    {viewingProfile && <div className="report-overlay"><section className="panel report-dialog"><button className="back-chat" onClick={() => setViewingProfile(null)}>← Назад</button><h2>{viewingProfile.name || 'Пользователь'}{viewingProfile.age ? ', ' + viewingProfile.age : ''}</h2><RoleBadge role={viewingProfile.public_role} label={viewingProfile.role_label}/>{viewingProfile.media_type==='video'&&viewingProfile.media_url ? <video src={viewingProfile.media_url} controls playsInline style={{width:'100%',maxHeight:360,borderRadius:14,background:'#0f0d16',margin:'14px 0'}}/> : (viewingProfile.media_url||viewingProfile.photo_url) ? <img src={viewingProfile.media_url||viewingProfile.photo_url} alt="Медиа анкеты" style={{width:'100%',maxHeight:320,objectFit:'contain',borderRadius:14,background:'#0f0d16',margin:'14px 0'}}/> : null}<p><b>Город:</b> {[viewingProfile.city,viewingProfile.country].filter(Boolean).join(', ') || 'Не указан'}</p><p><b>О себе:</b> {viewingProfile.description || viewingProfile.bio || 'Описание не добавлено.'}</p><p><b>Интересы:</b> {(viewingProfile.interests || []).join(', ') || 'Не указаны'}</p>{String(viewingProfile.id) !== String(user?.id) && <div className="profile-actions"><button className="like" onClick={() => { const person = viewingProfile; setViewingProfile(null); like(person); }}><Heart size={17} fill="currentColor"/> Поставить лайк</button>{isMutualMatch(viewingProfile.id) ? <button className="save" onClick={() => openChat({user_id:viewingProfile.id,first_name:viewingProfile.name || 'Пользователь',photo_url:viewingProfile.photo_url})}><MessageCircle size={17}/> Написать в ЛС</button> : <button className="skip" type="button" disabled title="Чат откроется после взаимной симпатии"><Lock size={16}/> Чат после взаимной симпатии</button>}<button className="skip" onClick={() => { setReportingPerson(viewingProfile); setReportType('profile'); setReportReason(''); setReportDetails(''); setReporterUsername(user?.username?'@'+user.username:''); setReportedUsername(viewingProfile.username?'@'+viewingProfile.username:''); setReportEvidence(''); setReportEvidenceName(''); setViewingProfile(null); }}>Пожаловаться</button></div>}</section></div>}


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
        {isMutualMatch(person.id) ? <button className="save" onClick={()=>openChat({user_id:person.id,first_name:person.name||'Пользователь',photo_url:person.photo_url})}><MessageCircle size={15}/> Написать</button> : <button className="skip" disabled title="Чат откроется после взаимной симпатии"><Lock size={15}/> Ждём ответ</button>}
      </div>)}
      <button className="save" style={{marginTop:18}} onClick={() => { setTab('chats'); refreshChats(); }}>Открыть чаты <MessageCircle size={16}/></button>
    </section>}
    {!loading && tab === 'chats' && <section className="panel"><div className="panel-icon"><MessageCircle/></div><h2>Твои чаты</h2><p>Переписывайся напрямую с людьми из ленты VIBE.</p>{chats.length === 0 ? <div className="empty"><Heart/><h3>Пока нет чатов</h3><p>Открой ленту и нажми «ЛС» у понравившегося человека, чтобы начать разговор.</p></div> : chats.map(chat => <button className="chat-row" key={chat.user_id} onClick={() => openChat(chat)}><span className="chat-avatar">{(chat.first_name || '?').slice(0,1)}</span><span className="chat-row-copy"><b>{chat.first_name}</b><small>{chat.last_message || 'Начни разговор 👋'}</small></span><MessageCircle size={18}/></button>)}</section>}
    {!loading && tab === 'chat' && activeChat && <section className="panel chat-panel"><button className="back-chat" onClick={() => { setTab('chats'); refreshChats(); }}>← Все чаты</button><h2>Чат с {activeChat.first_name}</h2><div className="messages-list">{messages.map(message => <div className={'message-bubble ' + (String(message.sender_id) === String(user?.id) ? 'mine' : '')} key={message.id}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}</div><form className="chat-compose" onSubmit={sendMessage}><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} placeholder="Напиши сообщение…" required disabled={sendingMessage}/><button className="like" type="submit" disabled={sendingMessage || !draft.trim()} aria-label="Отправить сообщение">{sendingMessage ? <RefreshCw size={17} className="spin"/> : <ArrowRight size={17}/>}</button></form></section>}
    {!loading && tab === 'listing' && <section className="panel profile-panel"><div className="panel-icon"><PlusCircle/></div><h2>Добавить анкету</h2><p>Это отдельная публичная анкета для рекомендаций. Она не меняет данные твоего профиля Telegram.</p><form onSubmit={publishListing}>
      <label>Имя<input value={listing.name} onChange={e=>setListing({...listing,name:e.target.value})} minLength={2} maxLength={60} placeholder="Как тебя показывать" required/></label>
      <label>Возраст (14–100 лет)<input type="number" inputMode="numeric" min="14" max="100" step="1" value={listing.age} onChange={e=>setListing({...listing,age:e.target.value})} placeholder="Например, 22" required/></label>
      <label>Город<input value={listing.city} onChange={e=>setListing({...listing,city:e.target.value})} minLength={2} maxLength={80} placeholder="Например, Берлин" required/></label>
      <label>Страна<input value={listing.country} onChange={e=>setListing({...listing,country:e.target.value})} minLength={2} maxLength={80} placeholder="Например, Германия" required/></label>
      <label>Фото или видео для ленты<span className="media-picker"><ImagePlus size={17}/>{listingMediaUrl ? 'Медиа выбрано · '+(listingMediaType==='video'?'видео':'фото') : 'Выбрать фото или видео'}<input type="file" accept="image/*,video/*" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const isVideo=file.type.startsWith('video/');if(!file.type.startsWith('image/')&&!isVideo){setError('Выбери фото или видео.');e.target.value='';return;}if(file.size>3*1024*1024){setError('Медиа должно быть не больше 3 МБ.');e.target.value='';return;}try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось прочитать медиа'));reader.readAsDataURL(file);});setListingMediaUrl(data);setListingMediaType(isVideo?'video':'image');setError('');setNotice('Медиа готово к публикации.');}catch(err){setError(err.message);}e.target.value='';}}/></span></label>{listingMediaUrl && <div className="listing-media-preview">{listingMediaType==='video'?<video src={listingMediaUrl} controls playsInline/>:<img src={listingMediaUrl} alt="Предпросмотр публикации"/>}<button className="skip" type="button" onClick={()=>{setListingMediaUrl('');setListingMediaType('image');}}>Убрать медиа</button></div>}
      <label>Хобби и занятия<textarea value={listing.hobbies} onChange={e=>setListing({...listing,hobbies:e.target.value})} maxLength={300} placeholder="Музыка, спорт, игры, прогулки…"/></label>
      <label>Описание<textarea value={listing.description} onChange={e=>setListing({...listing,description:e.target.value})} maxLength={1000} placeholder="Расскажи о себе без мата и пошлостей" required/></label>
      <p className="field-hint">Текст проверяется перед отправкой. Возрастные группы VIBE разделены на стороне сервера; взрослый доступ требует подтверждения возраста.</p>
      <button className="save" type="submit" disabled={publishing}><PlusCircle size={16}/>{publishing?'Публикуем…':'Опубликовать анкету'}<ArrowRight size={16}/></button>
    </form></section>}
    {profileOpen && <div className="report-overlay" onClick={e => { if (e.target === e.currentTarget && user?.birth_date) setProfileOpen(false); }}><section className="panel report-dialog profile-modal account-profile-modal">{user?.birth_date && <button className="back-chat" type="button" onClick={() => setProfileOpen(false)}>← Закрыть профиль</button>}{!user?.birth_date && <p className="field-hint">Сначала заполни обязательные данные профиля. Без даты рождения продолжить нельзя.</p>}<div className="account-avatar">{user?.photo_url ? <img src={user.photo_url} alt="Аватар" /> : <UserRound size={42}/>}</div><h2>{user?.username ? '@' + user.username : (user?.first_name || 'Пользователь')}</h2><RoleBadge role={user?.public_role} label={user?.role_label}/><div className="account-profile-stats"><div><span>Код аккаунта</span><strong>{user?.account_code || String(user?.id || '').padStart(6,'0')}</strong></div><div><span>Симпатии</span><strong><Heart size={17} fill="currentColor"/> {user?.likes_received || 0}</strong></div></div>
      <form className="profile-panel profile-editor-form" onSubmit={saveProfile}>
        <h3>Настроить анкету</h3>
        <p className="field-hint">Эти данные помогают VIBE подбирать совместимые знакомства. Не указывай точный адрес.</p>
        <label>Фото профиля
          {profile.photoUrl && <img className="profile-editor-photo" src={profile.photoUrl} alt="Предпросмотр фото профиля"/>}
          <span className="media-picker"><ImagePlus size={17}/>{uploadingMedia ? 'Обрабатываем фото…' : 'Выбрать фото'}<input type="file" accept="image/*" onChange={chooseMedia} disabled={uploadingMedia}/></span>
        </label>
        <label>Дата рождения <span aria-hidden="true">*</span><input type="date" required value={profile.birthDate} max={new Date().toISOString().slice(0,10)} onChange={e=>setProfile({...profile,birthDate:e.target.value})}/><span className="field-hint">Дата рождения определяет возрастную сторону: 14–17 лет или 18+. Не указывай ложную дату.</span></label>
        <label>Пол<select value={profile.gender} onChange={e=>setProfile({...profile,gender:e.target.value})}><option value="">Не указан</option><option value="woman">Женский</option><option value="man">Мужской</option><option value="nonbinary">Небинарный</option><option value="prefer_not_to_say">Не хочу указывать</option></select></label>
        <label>Город<input value={profile.city} maxLength={80} onChange={e=>setProfile({...profile,city:e.target.value})} placeholder="Например, Берлин"/></label>
        <label>О себе<textarea value={profile.bio} maxLength={500} onChange={e=>setProfile({...profile,bio:e.target.value})} placeholder="Расскажи немного о себе…"/></label>
        <label>Цель знакомства<select value={profile.goal} onChange={e=>setProfile({...profile,goal:e.target.value})}><option value="both">Общение и отношения</option><option value="friendship">Дружба</option><option value="chat">Общение</option><option value="relationship">Отношения</option></select></label>
        <label>Интересы через запятую<input value={profile.interests} maxLength={500} onChange={e=>setProfile({...profile,interests:e.target.value})} placeholder="Музыка, игры, кино, спорт"/></label>
        <p className="field-hint">VIBE разделяет пользователей на подростковую сторону (14–17 лет) и взрослую сторону (18+). Доступ к взрослой стороне требует подтверждения возраста.</p>
        <button className="save" type="submit" disabled={saving || uploadingMedia || !profile.birthDate}><Lock size={15}/>{saving ? 'Сохраняем…' : 'Сохранить профиль'}</button>
        <button className="skip profile-public-listing-link" type="button" disabled={!user?.birth_date} onClick={() => { setProfileOpen(false); setTab('listing'); }}><PlusCircle size={15}/> Управлять публичной анкетой</button>
      </form>
      </section></div>}
    {reportingPerson && <div className="report-overlay" onClick={e=>{if(e.target===e.currentTarget){setReportingPerson(null);setError('');}}}><section className="panel report-dialog"><button className="back-chat" type="button" onClick={()=>{setReportingPerson(null);setError('');}}>← Назад</button><h2>Пожаловаться на {reportType === 'post' ? 'публикацию' : 'профиль'}</h2><p>Жалоба отправится модерации VIBE. Причина обязательна; доказательства можно приложить, если они есть.</p><form onSubmit={submitReport}><label>Твой Telegram-юзернейм<input value={reporterUsername} onChange={e=>setReporterUsername(e.target.value)} placeholder="@твой_username" maxLength={64} required/></label><label>Telegram-юзернейм пользователя<input value={reportedUsername} onChange={e=>setReportedUsername(e.target.value)} placeholder="@username_на_кого_жалоба" maxLength={64} required/></label><label>Обязательная причина<select value={reportReason} onChange={e=>setReportReason(e.target.value)} required><option value="" disabled>Выбери причину</option><option>Спам</option><option>Оскорбления или угрозы</option><option>Фейковая анкета</option><option>Неприемлемый контент</option><option>Подозрение на мошенничество</option><option>Преследование или угрозы безопасности</option><option>Другое</option></select></label><label>Подробности<textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} maxLength={1000} placeholder="Опиши, что произошло (необязательно)"/></label><label>Доказательства (необязательно)<span className="media-picker"><ImagePlus size={17}/>{reportEvidenceName || 'Прикрепить фото, видео или PDF'}<input type="file" accept="image/*,video/*,application/pdf" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){setError('Доказательство должно быть не больше 2 МБ.');e.target.value='';return;}try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось прочитать файл'));reader.readAsDataURL(file);});setReportEvidence(data);setReportEvidenceName(file.name);setError('');}catch(err){setError(err.message);}e.target.value='';}}/></span></label>{reportEvidence && <button className="skip" type="button" onClick={()=>{setReportEvidence('');setReportEvidenceName('');}}>Убрать доказательство</button>}<button className="save" type="submit" disabled={reportSubmitting}>{reportSubmitting?'Отправляем…':'Отправить жалобу'}</button></form></section></div>}
    <nav className="mobile-nav" aria-label="Основная навигация"><button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass size={20}/><span>Поиск</span></button><button className={tab === 'likes' ? 'active' : ''} onClick={async () => { setTab('likes'); try { const data = await request('/api/likes'); setLikesData({incoming:data.incoming||[],outgoing:data.outgoing||[]}); } catch(e) { setError(e.message); } }}><Heart size={20}/><span>Симпатии</span>{likesData.incoming.length > 0 && <i>{likesData.incoming.length}</i>}</button><button className={tab === 'chats' || tab === 'chat' ? 'active' : ''} onClick={() => { setTab('chats'); refreshChats(); }}><MessageCircle size={20}/><span>Чаты</span>{chats.length > 0 && <i>{chats.length}</i>}</button><button className={tab === 'listing' ? 'active' : ''} onClick={() => { setProfileOpen(false); setTab('listing'); }}><PlusCircle size={20}/><span>Моя анкета</span></button></nav>
    <footer><span>vibe. © 2026</span><span className="site-legal-links"><a href="/rules">Правила проекта</a><a href="/privacy">Конфиденциальность</a><Lock size={12}/> Безопасность важна</span></footer>
  </main>;
}


function Landing() {
  const [language,setLanguage] = useState(() => { try { return localStorage.getItem('vibe-language') || 'en'; } catch { return 'en'; } });
  useEffect(() => { const update=e=>setLanguage(e.detail || 'en'); window.addEventListener('vibe-language-change',update); document.documentElement.lang=language; return ()=>window.removeEventListener('vibe-language-change',update); }, [language]);
  const copy = {en:{tag:'YOUR WAVE · YOUR PEOPLE',eyebrow:'YOUR WAVE · YOUR PEOPLE',title1:'Not just',title2:'dating.',title3:'A vibe that matches.',desc:'Fewer random swipes. More people you actually want to talk to. Find your people right inside Telegram.',cta:'Start meeting people',trust1:'Sign in with Telegram',trust2:'Privacy controls',online:'A new way to connect',about:'About VIBE',proof1:'Interest-based profiles',proof2:'Likes & matches',proof3:'Chat in one place',section:'Meet people',comfort:'on your own terms.',aboutdesc:'Everything that matters — simple, beautiful and without the noise.',final:'Ready to find',vibe:'your vibe?',open:'Open VIBE',feature1:'Find your people',feature1desc:'Explore profiles of people who may share your interests and goals.',feature2:'Less randomness',feature2desc:'Discover people through profile details to make meeting others easier and more interesting.',feature3:'Start a conversation',feature3desc:'Likes, matches and chats come together in one app inside Telegram.',finaldesc:'Join through Telegram and create your profile.',rules:'Project rules',privacy:'Privacy',private:'Your privacy matters',demoTag:'YOUR KIND OF PEOPLE',demoKicker:'MAYBE YOUR VIBE',demoTitle:'New people',demoSub:' · real stories',interests:'Shared interests',match:'Mutual like'},de:{tag:'DEINE WELLE · DEINE MENSCHEN',eyebrow:'DEINE WELLE · DEINE MENSCHEN',title1:'Mehr als',title2:'Dating.',title3:'Der Vibe passt.',desc:'Weniger zufälliges Swipen. Mehr Menschen, mit denen du wirklich reden möchtest. Finde deine Leute direkt in Telegram.',cta:'Neue Leute kennenlernen',trust1:'Anmeldung über Telegram',trust2:'Datenschutzkontrolle',online:'Eine neue Art, Menschen kennenzulernen',about:'Über VIBE',proof1:'Profile nach Interessen',proof2:'Likes & Matches',proof3:'Chats an einem Ort',section:'Lerne Menschen kennen',comfort:'so, wie es zu dir passt.',aboutdesc:'Alles Wichtige — einfach, schön und ohne unnötigen Lärm.',final:'Bereit,',vibe:'deinen Vibe zu finden?',open:'VIBE öffnen',feature1:'Finde deine Leute',feature1desc:'Entdecke Profile von Menschen mit ähnlichen Interessen und Zielen.',feature2:'Weniger Zufall',feature2desc:'Profildetails helfen dir, interessante Menschen leichter kennenzulernen.',feature3:'Starte ein Gespräch',feature3desc:'Likes, Matches und Chats sind in einer App in Telegram vereint.',finaldesc:'Melde dich über Telegram an und erstelle dein Profil.',rules:'Projektregeln',privacy:'Datenschutz',private:'Deine Privatsphäre ist wichtig',demoTag:'MENSCHEN NACH DEINEM GESCHMACK',demoKicker:'VIELLEICHT DEIN VIBE',demoTitle:'Neue Menschen',demoSub:' · echte Geschichten',interests:'Gemeinsame Interessen',match:'Gegenseitiges Like'},ru:{tag:'ТВОЯ ВОЛНА · ТВОИ ЛЮДИ',eyebrow:'ТВОЯ ВОЛНА · ТВОИ ЛЮДИ',title1:'Не просто',title2:'знакомства.',title3:'Совпадение вайбов.',desc:'Меньше случайных свайпов. Больше людей, с которыми есть о чём поговорить. Найди своё общение прямо в Telegram.',cta:'Начать знакомство',trust1:'Вход через Telegram',trust2:'Контроль приватности',online:'Знакомства нового уровня',about:'О VIBE',proof1:'Анкеты по интересам',proof2:'Симпатии и совпадения',proof3:'Общение в одном месте',section:'Знакомься',comfort:'так, как тебе комфортно.',aboutdesc:'Всё важное — просто, красиво и без лишней суеты.',final:'Готов найти',vibe:'свой вайб?',open:'Открыть VIBE',feature1:'Встречай своих',feature1desc:'Открывай анкеты людей, которые могут совпасть с тобой по интересам и целям знакомства.',feature2:'Меньше случайности',feature2desc:'Подборка использует информацию анкеты, чтобы знакомиться было проще и интереснее.',feature3:'Начинай общение',feature3desc:'Симпатии, совпадения и чаты собраны в одном приложении внутри Telegram.',finaldesc:'Зайди через Telegram и создай свою анкету.',rules:'Правила проекта',privacy:'Конфиденциальность',private:'Твоя приватность важна',demoTag:'ТВОЙ ТИП ЛЮДЕЙ',demoKicker:'ВОЗМОЖНО, ВАШ ВАЙБ',demoTitle:'Новые люди',demoSub:' · настоящие истории',interests:'По общим интересам',match:'Взаимная симпатия'}}[language] || {};
  return <main className="app-shell landing-shell">
    <header className="topbar landing-topbar">
      <a className="brand" href="#" aria-label="VIBE главная"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></a>
      <div className="landing-top-actions"><LanguagePicker/><span className="landing-online"><i/> {copy.online}</span><a className="landing-menu" href="#about">{copy.about} <ArrowRight size={14}/></a></div>
    </header>
    <section className="landing-hero">
      <div className="landing-copy">
        <div className="eyebrow"><Sparkles size={14}/> {copy.eyebrow}</div>
        <h1>{copy.title1}<br/>{copy.title2}<br/><span>{copy.title3}</span></h1>
        <p>{copy.desc}</p>
        <a className="register-button" href="https://t.me/iBEDatig_Bot?start=register"><span className="telegram-icon">➤</span> {copy.cta} <ArrowRight size={18}/></a>
        <div className="landing-trust"><span><Lock size={14}/> {copy.trust1}</span><span><ShieldCheck size={14}/> {copy.trust2}</span></div>
      </div>
      <div className="landing-visual" aria-label="Пример карточки знакомства">
        <div className="landing-orbit landing-orbit-one"/><div className="landing-orbit landing-orbit-two"/>
        <div className="landing-float-chip landing-float-top"><Sparkles size={15}/> {copy.interests}</div>
        <article className="landing-demo-card">
          <div className="landing-demo-photo"><div className="landing-demo-glow"/><span className="landing-demo-monogram">v.</span><span className="landing-demo-tag"><i/> {copy.demoTag}</span></div>
          <div className="landing-demo-info"><div><span className="landing-demo-kicker">{copy.demoKicker}</span><h2>{copy.demoTitle}<span>{copy.demoSub}</span></h2></div><div className="landing-demo-actions"><span><Heart size={17}/></span><span><MessageCircle size={17}/></span></div></div>
        </article>
        <div className="landing-float-chip landing-float-bottom"><Heart size={15} fill="currentColor"/> {copy.match}</div>
        <div className="landing-orbit-dot dot-a">✦</div><div className="landing-orbit-dot dot-b">♡</div>
      </div>
    </section>
    <section className="landing-proof"><div><strong>01</strong><span>{copy.proof1}</span></div><div><strong>02</strong><span>{copy.proof2}</span></div><div><strong>03</strong><span>{copy.proof3}</span></div></section>
    <section className="landing-about" id="about">
      <div className="landing-section-heading"><span className="eyebrow"><Sparkles size={13}/> ТВОЙ VIBE</span><h2>{copy.section}<br/><span>{copy.comfort}</span></h2><p>{copy.aboutdesc}</p></div>
      <div className="landing-features">
        <article className="landing-feature-card feature-purple"><span className="feature-icon"><Heart/></span><span className="feature-number">01 / CONNECT</span><h3>{copy.feature1}</h3><p>{copy.feature1desc}</p><div className="feature-art feature-heart"><Heart size={72}/><Sparkles size={23}/></div></article>
        <article className="landing-feature-card feature-blue"><span className="feature-icon"><Sparkles/></span><span className="feature-number">02 / DISCOVER</span><h3>{copy.feature2}</h3><p>{copy.feature2desc}</p><div className="feature-art feature-spark"><span>✳</span><span>✦</span><span>✧</span></div></article>
        <article className="landing-feature-card feature-pink"><span className="feature-icon"><MessageCircle/></span><span className="feature-number">03 / TALK</span><h3>{copy.feature3}</h3><p>{copy.feature3desc}</p><div className="feature-art feature-chat"><span>Привет! 👋</span><span>Кажется, у нас общий вайб</span></div></article>
      </div>
    </section>
    <section className="landing-final-cta"><div><span className="eyebrow"><Sparkles size={13}/> ТВОЯ ИСТОРИЯ НАЧИНАЕТСЯ ЗДЕСЬ</span><h2>{copy.final}<br/><span>{copy.vibe}</span></h2><p>{copy.finaldesc}</p></div><a className="register-button" href="https://t.me/iBEDatig_Bot?start=register"><span className="telegram-icon">➤</span> {copy.open} <ArrowRight size={18}/></a></section>
    <footer><span>vibe. © 2026</span><span className="site-legal-links"><a href="/rules">{copy.rules}</a><a href="/privacy">{copy.privacy}</a><Lock size={12}/> {copy.private}</span></footer>
  </main>;
}


function LegalPage() {
  const privacy = window.location.pathname === '/privacy';
  const title = privacy ? 'Политика конфиденциальности' : 'Правила проекта';
  return <main className="app-shell legal-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="VIBE — главная"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></a>
      <a className="landing-menu" href="/">На главную <ArrowRight size={14}/></a>
    </header>
    <section className="legal-hero">
      <div className="eyebrow"><Lock size={14}/> ОФИЦИАЛЬНЫЕ ДОКУМЕНТЫ VIBE</div>
      <h1>{title}</h1>
      <p>Действующая редакция от 23 октября 2026 года</p>
      <nav className="legal-switch" aria-label="Юридические документы">
        <a className={!privacy ? 'selected' : ''} href="/rules">Правила проекта</a>
        <a className={privacy ? 'selected' : ''} href="/privacy">Конфиденциальность</a>
      </nav>
    </section>
    {privacy ? <article className="legal-document">
      <p className="legal-lead">Настоящая Политика описывает, какие сведения обрабатываются при использовании VIBE, для каких целей они используются и какие меры применяются для их защиты.</p>
      <h2>1. Общие положения</h2>
      <p>VIBE — сервис для знакомств и общения, доступный через Telegram. Используя сервис, пользователь подтверждает, что ознакомился с настоящей Политикой. Если пользователь не согласен с её условиями, он должен прекратить использование VIBE.</p>
      <p>Обработка данных осуществляется в соответствии с применимым законодательством о защите персональных данных, включая Общий регламент по защите данных (GDPR), когда он применим.</p>
      <h2>2. Какие сведения могут обрабатываться</h2>
      <ul><li>идентификаторы Telegram, имя и имя пользователя, необходимые для авторизации и работы сервиса;</li><li>сведения анкеты: дата рождения или подтверждение возрастного статуса, город, описание, интересы, цель знакомства и фотография;</li><li>публикации, изображения и видео, которые пользователь размещает в сервисе;</li><li>данные о симпатиях, совпадениях, сообщениях и взаимодействии с другими пользователями;</li><li>жалобы, обращения в поддержку, сведения о нарушениях и применённых мерах модерации;</li><li>технические данные и журналы событий, необходимые для защиты, диагностики ошибок и предотвращения злоупотреблений.</li></ul>
      <p>Сервис не запрашивает пароль от Telegram. Не размещайте в анкете или переписке данные, которые не хотите раскрывать другим пользователям.</p>
      <h2>3. Цели и правовые основания обработки</h2>
      <p>Данные используются для предоставления функций VIBE, авторизации, показа анкет, работы чатов, обеспечения безопасности, рассмотрения жалоб, предотвращения мошенничества, исполнения юридических обязанностей и защиты законных интересов сервиса и пользователей.</p>
      <p>В зависимости от ситуации правовым основанием могут являться исполнение условий использования, согласие пользователя, соблюдение правовых обязанностей или законные интересы, если они не преобладают над правами и свободами пользователя.</p>
      <h2>4. Видимость информации</h2>
      <p>Сведения, добавленные в публичную анкету или публикацию, могут быть доступны другим пользователям VIBE. Сообщения доступны участникам соответствующего чата и уполномоченным лицам в объёме, необходимом для рассмотрения жалоб и обеспечения безопасности. Не публикуйте адрес проживания, документы, финансовые сведения и иные чувствительные данные.</p>
      <h2>4.1. Проверка фотографий, видео и сообщений</h2>
      <p>Фотографии и видео, загружаемые в анкеты и публикации, могут проверяться автоматическими средствами и уполномоченными модераторами для выявления запрещённого контента, поддельных профилей, мошенничества, нарушений прав на изображение и угроз безопасности. При рассмотрении жалобы модераторы могут просматривать относящиеся к ней материалы и сообщения в объёме, необходимом для проверки обстоятельств. Не отправляйте в VIBE материалы, которые не готовы предоставить для такой проверки.</p>
      <p>Доступ к материалам модерации должен ограничиваться лицами, которым он необходим для обеспечения безопасности и рассмотрения жалоб. Проверка может привести к отклонению или удалению публикации, ограничению функций либо блокировке аккаунта. Автоматические средства могут ошибаться и сами по себе не всегда подтверждают, что изображение поддельное; при возможности решение рассматривается с учётом контекста и обращения пользователя.</p>
      <p>Медиа и связанные с жалобой сведения хранятся в течение периода, необходимого для проверки, работы сервиса и предотвращения повторных нарушений, а затем удаляются или обезличиваются, если дальнейшее хранение не требуется по закону или для разрешения спора. Конкретный срок зависит от типа данных и технических возможностей сервиса. Пользователь может обратиться через официальный Telegram-бот VIBE с вопросом о проверке, удалении данных или пересмотре решения модерации.</p>
      <h2>5. Передача данных третьим лицам</h2>
      <p>Данные могут обрабатываться Telegram в рамках работы платформы, а также поставщиками инфраструктуры и технических услуг, которые обеспечивают размещение, хранение и работу VIBE. Передача также возможна при наличии законного требования компетентного органа либо когда она необходима для защиты прав, безопасности пользователей или предотвращения противоправных действий.</p>
      <p>Данные не продаются третьим лицам для их собственных маркетинговых целей. Передача поставщикам услуг ограничивается тем, что необходимо для выполнения соответствующих задач.</p>
      <h2>6. Сроки хранения</h2>
      <p>Информация хранится столько, сколько необходимо для работы сервиса, обеспечения безопасности, рассмотрения споров и исполнения правовых обязанностей. Отдельные сведения могут сохраняться ограниченное время после удаления аккаунта, если это необходимо для предотвращения повторных нарушений, расследования инцидентов или соблюдения закона.</p>
      <h2>7. Защита информации</h2>
      <p>Применяются разумные технические и организационные меры защиты, включая разграничение доступа и меры предотвращения несанкционированного использования. Ни один способ передачи или хранения данных не может гарантировать абсолютную безопасность.</p>
      <h2>8. Права пользователя</h2>
      <p>В пределах, предусмотренных применимым законодательством, пользователь может запросить доступ к своим персональным данным, исправление неточных сведений, удаление данных, ограничение обработки, возразить против обработки или запросить переносимость данных. Если обработка основана на согласии, его можно отозвать; это не влияет на законность обработки до отзыва.</p>
      <p>Для реализации прав или обращения по вопросам конфиденциальности используйте доступный канал связи с администрацией VIBE через официальный Telegram-бот сервиса. Для защиты аккаунта может потребоваться подтверждение личности.</p>
      <h2>9. Данные несовершеннолетних</h2>
      <p>VIBE разделён на две возрастные стороны: подростковую для пользователей от 14 до 17 лет включительно и взрослую для пользователей от 18 лет. Подростковая и взрослая стороны изолированы друг от друга: анкеты, симпатии и личные сообщения доступны только внутри соответствующей возрастной стороны. Пользователям младше 14 лет пользоваться сервисом запрещено. При выявлении недостоверного возраста доступ может быть ограничен.</p>
      <h2>10. Файлы и внешние сервисы</h2>
      <p>VIBE работает через Telegram и может использовать технические механизмы, необходимые для функционирования веб-интерфейса. Telegram и другие внешние поставщики могут применять собственные технологии и политики конфиденциальности. Ознакомьтесь с документами соответствующих платформ.</p>
      <h2>11. Изменения Политики</h2>
      <p>Политика может обновляться при изменении функций сервиса, способов обработки данных или применимого законодательства. Актуальная редакция публикуется на этой странице. Существенные изменения могут дополнительно доводиться до сведения пользователей доступными средствами.</p>
      <h2>12. Контакт и обращения</h2>
      <p>Вопросы, запросы и обращения, связанные с обработкой персональных данных, можно направить администрации через официальный Telegram-бот VIBE. В обращении укажите, какое право вы хотите реализовать, и предоставьте сведения, необходимые для проверки запроса.</p>
      <p className="legal-note">Настоящий документ описывает общие правила обработки данных в сервисе. Перед коммерческим запуском следует дополнить его юридическими реквизитами оператора, контактами ответственного лица и конкретными сроками хранения, соответствующими фактической инфраструктуре VIBE.</p>
    </article> : <article className="legal-document">
      <p className="legal-lead">Настоящие Правила определяют условия безопасного использования VIBE, требования к анкетам, публикациям и общению, а также основания для применения мер модерации.</p>
      <h2>1. Общие условия</h2>
      <p>Используя VIBE, пользователь обязуется соблюдать настоящие Правила, применимое законодательство и требования платформы Telegram. Пользователь несёт ответственность за содержание размещаемой информации и свои действия в сервисе.</p>
      <p>VIBE доступен пользователям от 14 лет. При первом заполнении даты рождения пользователь попадает в подростковую сторону (14–17 лет) либо во взрослую сторону (18+). Между сторонами не показываются анкеты друг друга и не допускаются симпатии или личные сообщения. Запрещено указывать ложный возраст, обходить возрастное разделение или предоставлять доступ к аккаунту другому лицу.</p>
      <h2>2. Достоверность анкеты</h2>
      <ul><li>Указывайте достоверную информацию о себе и цели знакомства.</li><li>Не выдавайте себя за другого человека, публичную личность или представителя организации.</li><li>Не используйте фотографии и материалы других лиц без законных оснований и необходимого разрешения.</li><li>Не создавайте аккаунты для обмана, обхода ограничений или манипулирования работой сервиса.</li><li>Не размещайте ссылки и контактные сведения с целью спама, мошенничества или массового привлечения пользователей.</li></ul>
      <h2>3. Запрещённые материалы</h2>
      <p>В VIBE запрещается публиковать, передавать или распространять:</p>
      <ul><li>порнографические, сексуально эксплуатирующие материалы и непрошеный откровенный контент;</li><li>любые материалы сексуального характера с участием несовершеннолетних, а также попытки вовлечения несовершеннолетних в сексуальную коммуникацию;</li><li>сцены жестокого насилия, угрозы расправой, призывы к насилию или материалы, направленные на запугивание;</li><li>контент, содержащий травлю, унижение, дискриминацию или разжигание ненависти по защищаемым признакам;</li><li>персональные данные, частную переписку, интимные изображения или записи других лиц без надлежащего разрешения;</li><li>материалы, нарушающие авторские права, права на изображение, неприкосновенность частной жизни или иные права третьих лиц;</li><li>незаконные предложения, мошеннические схемы, фишинг, вредоносные ссылки и рекламу запрещённых товаров или услуг.</li></ul>
      <h2>3.1. Требования к фотографиям и видео</h2>
      <p>Для фотографий профиля и публикаций действуют дополнительные требования. Запрещено загружать:</p>
      <ul><li>порнографию, обнажённые интимные части тела, сексуально откровенные изображения и материалы сексуальной эксплуатации; любые сексуальные изображения несовершеннолетних строго запрещены;</li><li>поддельные фотографии, дипфейки или изображения, выдающие пользователя за другого человека, если это вводит людей в заблуждение или нарушает их права;</li><li>чужие фотографии без необходимых прав или разрешения, а также изображения, используемые для преследования, шантажа или унижения;</li><li>угрозы, травлю, дискриминационные изображения, жестокое насилие или незаконные материалы;</li><li>пустые, полностью чёрные, нечитаемые, повреждённые изображения, случайные файлы и медиа, не относящиеся к анкете или публикации;</li><li>изображения с личными документами, адресами, телефонами или другими чужими персональными данными без законных оснований.</li></ul>
      <p>Не каждое стилизованное изображение или фильтр означает подделку. При оценке учитываются контекст, возможный обман, права изображённых людей и безопасность пользователей.</p>
      <h2>4. Общение и уважение</h2>
      <p>Запрещены угрозы, преследование, шантаж, навязчивые сообщения после выраженного отказа, сексуальные домогательства, оскорбления и попытки принудить другого пользователя к общению или встрече.</p>
      <p>Согласие на общение в VIBE не означает согласия на передачу личных данных, интимный контент, встречу или любые действия вне сервиса. Уважайте отказ и личные границы других пользователей.</p>
      <h2>5. Спам, мошенничество и манипуляции</h2>
      <p>Запрещены массовые однотипные сообщения, навязчивая реклама, мошенничество, выдача себя за другого человека, использование ботов для имитации активности, искусственное создание симпатий и обход технических ограничений VIBE.</p>
      <h2>6. Безопасность и приватность</h2>
      <p>Не публикуйте чужие адреса, телефоны, документы, финансовые сведения, местоположение в реальном времени и иную информацию, способную создать угрозу безопасности. Запрещено распространять личные материалы с целью давления, унижения или мести.</p>
      <p>Будьте осторожны при переходе по ссылкам, передаче денег и организации личных встреч. Не переводите деньги людям, с которыми познакомились в интернете, если не можете проверить обстоятельства. При встрече выбирайте общественное место и сообщайте близкому человеку о своих планах.</p>
      <h2>7. Жалобы и модерация</h2>
      <p>Пользователь вправе сообщить о нарушении через предусмотренную в VIBE функцию жалобы. По возможности укажите конкретную публикацию или профиль, причину и проверяемые обстоятельства. Не направляйте заведомо ложные жалобы и не используйте систему жалоб для преследования других пользователей.</p>
      <p>Модерация рассматривает сообщения с учётом характера нарушения, доступных материалов, повторности и риска для пользователей. Администрация может запросить дополнительные сведения, ограничить распространение контента или применить меры к аккаунту.</p>
      <p>Фотографии и видео анкет и публикаций могут направляться на проверку модераторам до публикации или после жалобы. Материалы и сообщения, относящиеся к жалобе, могут быть просмотрены уполномоченными модераторами. Проверка может включать автоматические средства, но они не гарантируют безошибочного определения нарушений. При несогласии с решением пользователь может обратиться через официальный Telegram-бот VIBE с просьбой о пересмотре.</p>
      <h2>8. Меры за нарушения</h2>
      <p>В зависимости от тяжести и повторности нарушения могут применяться предупреждение, удаление или скрытие материала, временное ограничение функций, временная блокировка либо бессрочная блокировка аккаунта. При серьёзной угрозе безопасности или очевидном тяжёлом нарушении ограничение может быть применено без предварительного предупреждения.</p>
      <p>Основаниями для блокировки могут быть спам, мошенничество, травля и угрозы, дискриминация, сексуальные домогательства, нарушение возрастных ограничений, фальшивые анкеты, запрещённый контент, нарушение приватности, незаконная деятельность, манипуляции, обход ранее применённой блокировки и злоупотребление системой жалоб.</p>
      <p>Решения принимаются с учётом доступных обстоятельств. Пользователь может направить администрации обращение с просьбой пересмотреть решение через официальный Telegram-бот VIBE. Обращение не гарантирует отмену ограничения.</p>
      <h2>9. Контент пользователей и права на него</h2>
      <p>Пользователь сохраняет права на созданные им материалы и подтверждает, что имеет необходимые права и разрешения для их размещения. Размещая контент, пользователь предоставляет VIBE ограниченное неисключительное разрешение на его хранение, обработку, отображение и передачу в объёме, необходимом для функционирования сервиса.</p>
      <p>Пользователь обязан удалить материал или прекратить его использование, если выяснится, что его размещение нарушает права третьих лиц или закон.</p>
      <h2>10. Доступность сервиса</h2>
      <p>VIBE может изменять, приостанавливать или прекращать работу отдельных функций для обслуживания, обеспечения безопасности или соблюдения закона. Администрация не гарантирует непрерывную и безошибочную работу сервиса и не несёт ответственности за действия пользователей вне пределов, установленных применимым законодательством.</p>
      <h2>11. Нарушения закона и сотрудничество с компетентными органами</h2>
      <p>Материалы и сведения могут быть сохранены или переданы компетентным органам, если это требуется применимым законом или необходимо для предотвращения непосредственной угрозы жизни и безопасности. Пользователям запрещено использовать VIBE для организации противоправных действий.</p>
      <h2>12. Изменение Правил</h2>
      <p>Правила могут обновляться при изменении функций VIBE, требований безопасности или применимого законодательства. Актуальная редакция публикуется на этой странице. Продолжение использования сервиса после вступления изменений в силу означает дальнейшее использование VIBE на обновлённых условиях, если применимое законодательство не предусматривает иного.</p>
      <h2>13. Связь с администрацией</h2>
      <p>Вопросы по Правилам, сообщения о нарушениях и обращения по решениям модерации направляйте через официальный Telegram-бот VIBE.</p>
      <p className="legal-note">Правила применяются совместно с Политикой конфиденциальности VIBE. Если отдельное положение признаётся неприменимым, остальные положения сохраняют силу в допустимых законом пределах.</p>
    </article>}
    <footer className="legal-footer"><span>vibe. © 2026</span><span><a href="/rules">Правила</a><a href="/privacy">Конфиденциальность</a></span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(window.location.pathname === '/rules' || window.location.pathname === '/privacy' ? <LegalPage/> : <App/>);
