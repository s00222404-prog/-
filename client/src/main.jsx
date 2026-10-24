import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Compass, UserRound, ShieldAlert, MapPin, Sparkles, ArrowRight, Lock, RefreshCw, MessageCircle, ImagePlus, PlusCircle, BadgeCheck, Crown, ShieldCheck, Wrench, LayoutGrid, Rows3, Flag, Share2, SlidersHorizontal, X } from 'lucide-react';
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

function calculateAgeFromBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').slice(0, 10));
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth();
  const currentDay = today.getUTCDate();
  if (parsed > Date.UTC(currentYear, currentMonth, currentDay)) return null;
  let age = currentYear - year;
  if (currentMonth < month - 1 || (currentMonth === month - 1 && currentDay < day)) age--;
  return age;
}

function LanguagePicker({className=''}) {
  const [language,setLanguage] = useState(getStoredLanguage);
  function changeLanguage(value) {
    if (!Object.prototype.hasOwnProperty.call(LANGUAGES, value)) return;
    setLanguage(value);
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
    const translateRoot = () => {
      const root = document.querySelector('.app-shell');
      if (!root) return;
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
    };
    translateRoot();
    // The app shell may be rendered after the initial loading screen. Observe the
    // document so translation also starts when that shell appears.
    const observer = new MutationObserver(() => {
      const root = document.querySelector('.app-shell');
      if (!root) return;
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
      root.querySelectorAll('input[placeholder],textarea[placeholder],[aria-label],[title],option').forEach(el => {
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
        if (el.tagName === 'OPTION') {
          if (!translationOriginals.has(el.firstChild || el)) translationOriginals.set(el.firstChild || el, el.textContent);
          const original = translationOriginals.get(el.firstChild || el);
          if (original != null && el.textContent !== translateUiText(original, language)) el.textContent = translateUiText(original, language);
        }
      });
    });
    observer.observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
    return () => { observer.disconnect(); window.removeEventListener('vibe-language-change', updateLanguage); };
  }, [language]);
  const [tab, setTab] = useState('chats');
  const [user, setUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [likesData, setLikesData] = useState({incoming:[],outgoing:[]});
  const [likingIds, setLikingIds] = useState([]);
  const likingRef = useRef(new Set());
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
  const [feedCountry, setFeedCountry] = useState('all');
  const [feedGoal, setFeedGoal] = useState('all');
  const [feedInterest, setFeedInterest] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const [testLikes, setTestLikes] = useState([]);
  const [referralCount, setReferralCount] = useState(0);
  const messagesEndRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [listing, setListing] = useState({name:'',age:'',birthDate:'',gender:'',city:'',country:'',hobbies:'',interests:'',goal:'both',description:''});
  const [publishing, setPublishing] = useState(false);
  const [listingStep, setListingStep] = useState(1);

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
      error.restricted = Boolean(data.restricted);
      error.maintenance = Boolean(data.maintenance);
      error.reason = data.reason || '';
      error.banReason = data.reason || data.moderation_note || data.user?.moderation_note || '';
      error.banIssuer = data.ban_issuer_label || ((data.ban_issuer || data.user?.ban_issuer) === 'developer' ? 'разработчиком' : 'модератором');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, tab]);

  useEffect(() => {
    if (!initData || !user?.id || loading || user?.account_status === 'banned') return;
    const refreshInbox = async () => {
      if (document.visibilityState !== 'visible' || tab === 'chat') return;
      try {
        const [chatData, likesDataFresh, referralData, meData] = await Promise.all([
          request('/api/chats'),
          request('/api/likes').catch(() => null),
          request('/api/referrals').catch(() => null),
          request('/api/me').catch(() => null)
        ]);
        setChats(chatData.chats || []);
        if (likesDataFresh) {
          const incoming = likesDataFresh.incoming || [], outgoing = likesDataFresh.outgoing || [];
          setLikesData({incoming, outgoing});
          setMutualIds(incoming.filter(person => outgoing.some(other => String(other.id) === String(person.id))).map(person => String(person.id)));
        }
        if (referralData) setReferralCount(Number(referralData.count) || 0);
        if (meData?.user) setUser(current => ({...current, ...meData.user}));
      } catch { /* Inbox refresh is best-effort; keep the current screen usable. */ }
    };
    const timer = window.setInterval(refreshInbox, 15000);
    return () => window.clearInterval(timer);
  }, [user?.id, loading, tab]);

  useEffect(() => {
    if (tab !== 'chat' || !activeChat || String(activeChat.user_id).startsWith('vibe-test-')) return;
    const refreshConversation = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const data = await request('/api/chats/' + encodeURIComponent(activeChat.user_id) + '/messages');
        setMessages(current => {
          const byId = new Map(current.map(message => [String(message.id), message]));
          for (const message of (data.messages || [])) byId.set(String(message.id), message);
          return [...byId.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
      } catch { /* Keep the current conversation visible during temporary network failures. */ }
    };
    const timer = window.setInterval(refreshConversation, 8000);
    return () => window.clearInterval(timer);
  }, [tab, activeChat?.user_id]);

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
      if (!u.birth_date) setProfileOpen(false);
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
      if (mine.listing) { setListing(current=>({...current,name:mine.listing.name,age:String(mine.listing.age),birthDate:u.birth_date?String(u.birth_date).slice(0,10):'',gender:u.gender||'',city:mine.listing.city,country:mine.listing.country,hobbies:mine.listing.hobbies||'',interests:Array.isArray(u.interests)?u.interests.join(', '):'',goal:u.goal||'both',description:mine.listing.description||''})); setListingMediaUrl(mine.listing.media_url||''); setListingMediaType(mine.listing.media_type||'image'); } else { setListing(current=>({...current,birthDate:u.birth_date?String(u.birth_date).slice(0,10):'',gender:u.gender||'',city:u.city||'',interests:Array.isArray(u.interests)?u.interests.join(', '):'',goal:u.goal||'both',description:u.bio||''})); setTab('listing'); setListingStep(1); }
      if (!u.birth_date) { setTab('listing'); setListingStep(1); }
      const chatData = await request('/api/chats');
      setChats(chatData.chats || []);
      const referrals = await request('/api/referrals').catch(() => ({count:0}));
      setReferralCount(Number(referrals.count) || 0);
      const likes = await request('/api/likes').catch(() => ({incoming:[],outgoing:[]}));
      const incomingLikes = likes.incoming || [];
      const outgoingLikes = likes.outgoing || [];
      setLikesData({incoming:incomingLikes,outgoing:outgoingLikes});
      setMutualIds(incomingLikes.filter(person => outgoingLikes.some(other => String(other.id) === String(person.id))).map(person => String(person.id)));
    } catch (e) {
      if (e.maintenance) {
        setMaintenance({maintenance:true,reason:e.reason || 'VIBE временно закрыт на техническое обслуживание.'});
        setError('');
      } else if (e.banned) {
        setUser({ account_status: 'banned', moderation_note: e.banReason, ban_issuer_label: e.banIssuer });
        setError('');
      } else if (e.restricted) {
        setUser({ account_status: 'restricted', moderation_note: e.banReason || e.reason || 'Доступ временно ограничен.' });
        setError('');
      } else setError(e.message || 'Не удалось подключиться к VIBE API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetch(API+'/api/service-status').then(r=>r.json()).then(s=>{if(s.maintenance&&!initData)setMaintenance(s);else if(initData)loadApp();else setLoading(false)}).catch(()=>{if(initData)loadApp();else setLoading(false)}); }, []);

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
      const refreshedUser = await request('/api/me');
      setUser(refreshedUser.user);
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
    const personId = String(person.id);
    if (!personId || likingIds.includes(personId)) return;
    if (likingRef.current.has(personId)) return;
    likingRef.current.add(personId);
    setLikingIds(current => current.includes(personId) ? current : [...current, personId]);
    setError('');
    setNotice('');
    if (person.is_test_profile && user?.public_role === 'developer') {
      setTestLikes(current => current.includes(personId) ? current : [...current, personId]);
      setLikesData(current => ({incoming:current.incoming, outgoing:[person, ...current.outgoing.filter(p => String(p.id) !== personId)]}));
      setNotice('ТЕСТ: лайк демо-анкете обработан локально; реальный пользователь не уведомлялся.');
      likingRef.current.delete(personId);
      setLikingIds(current => current.filter(id => id !== personId));
      return;
    }
    const previousLikes = likesData;
    const previousMutual = mutualIds;
    // Optimistic UI: show the purple liked state immediately while the API confirms.
    setTestLikes(current => current.filter(id => id !== personId));
    setLikesData(current => ({
      incoming: current.incoming.filter(p => String(p.id) !== personId),
      outgoing: [person, ...current.outgoing.filter(p => String(p.id) !== personId)]
    }));
    setNotice('Сохраняем симпатию… 💜');
    try {
      const result = await request('/api/likes/' + encodeURIComponent(person.id), { method: 'POST' });
      if (result.matched) setMutualIds(current => current.includes(personId) ? current : [...current, personId]);
      setNotice(result.matched ? 'У вас взаимная симпатия 💜' : 'Симпатия отправлена 💜');
    } catch (e) {
      setLikesData(previousLikes);
      setMutualIds(previousMutual);
      setError(e.message || 'Не удалось отправить симпатию.');
    } finally {
      likingRef.current.delete(personId);
      setLikingIds(current => current.filter(id => id !== personId));
    }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!reportingPerson) return;
    if (!reportReason.trim()) {
      setError('Укажи обязательную причину жалобы.');
      return;
    }
    setReportSubmitting(true); setError('');
    try {
      const reportPayload = {reason:reportReason,details:reportDetails,evidence:reportEvidence,reportType,listingId:reportingPerson.listing_id || null,reporterUsername,reportedUsername,targetName:reportingPerson.name || 'Пользователь',targetUsername:reportingPerson.username || '',targetAge:reportingPerson.age || null};
      if (reportingPerson.is_test_profile) {
        await request('/api/reports/demo', { method:'POST', body:JSON.stringify(reportPayload) });
      } else {
        await request('/api/reports/' + encodeURIComponent(reportingPerson.id), { method:'POST', body:JSON.stringify(reportPayload) });
      }
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
    setDraft('');
    setError('');
    setNotice('');
    if (String(chat.user_id).startsWith('vibe-test-') && user?.public_role === 'developer') {
      setActiveChat(chat);
      setMessages([{id:'test-welcome-'+chat.user_id,sender_id:chat.user_id,body:'ТЕСТОВЫЙ АВТООТВЕТ: демо-чат открыт. Напиши сообщение, чтобы проверить тестовый ответ.',created_at:new Date().toISOString(),test_mode:true}]);
      setTab('chat');
      return;
    }
    setActiveChat(chat);
    setMessages([]);
    setTab('chat');
    try {
      const data = await request('/api/chats/' + encodeURIComponent(chat.user_id) + '/messages');
      setMessages(data.messages || []);
    } catch (e) { setError(e.message); }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!activeChat || !body || sendingMessage) return;
    setSendingMessage(true);
    setError('');
    if (String(activeChat.user_id).startsWith('vibe-test-') && user?.public_role === 'developer') {
      const now = new Date().toISOString();
      setMessages(current => [...current,
        {id:'test-user-'+Date.now(),sender_id:user.id,body,created_at:now,test_mode:true},
        {id:'test-reply-'+Date.now(),sender_id:activeChat.user_id,body:'ТЕСТОВЫЙ АВТООТВЕТ: сообщение получено демо-обработчиком. Это проверяет только тестовый интерфейс, не доставку реальному пользователю.',created_at:new Date(Date.now()+1).toISOString(),test_mode:true}
      ]);
      setDraft('');
      setNotice('Тестовое сообщение и автоответ показаны локально. Реальная доставка не проверялась.');
      setSendingMessage(false);
      return;
    }
    try {
      const data = await request('/api/chats/' + encodeURIComponent(activeChat.user_id) + '/messages', {
        method: 'POST', body: JSON.stringify({ body })
      });
      if (data.message) setMessages(current => [...current, data.message]);
      setDraft('');
      refreshChats();
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
      if (!listing.birthDate) {
        setListingStep(1);
        throw new Error('Укажи дату рождения, чтобы создать профиль.');
      }
      const age = calculateAgeFromBirthDate(listing.birthDate);
      if (age === null) {
        setListingStep(1);
        throw new Error('Проверь дату рождения.');
      }
      if (age < 14) {
        setListingStep(1);
        throw new Error('VIBE доступен с 14 лет. Возрастные группы разделены: 14–17 лет и 18+.');
      }
      const interests = [...new Set(listing.interests.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,20);
      // Save the private account profile first, then submit the public listing for review.
      await request('/api/me', {method:'PUT',body:JSON.stringify({
        birthDate:listing.birthDate,
        gender:listing.gender||null,
        bio:listing.description,
        city:listing.city.trim(),
        photoUrl:profile.photoUrl||null,
        goal:listing.goal||'both',
        interests
      })});
      const freshProfile = await request('/api/me');
      const currentUser = freshProfile.user;
      setUser(currentUser);
      const birthDate = currentUser?.age_verification_status === 'verified' && currentUser?.verified_birth_date
        ? String(currentUser.verified_birth_date).slice(0, 10)
        : currentUser?.birth_date ? String(currentUser.birth_date).slice(0, 10) : '';
      const verifiedAge = calculateAgeFromBirthDate(birthDate);
      if (verifiedAge === null || verifiedAge < 14) throw new Error('Не удалось подтвердить возраст для создания анкеты.');
      const result=await request('/api/listings',{method:'POST',body:JSON.stringify({...listing,age:verifiedAge,mediaUrl:listingMediaUrl||null,mediaType:listingMediaType})});
      const savedListing={...result.listing,age:String(result.listing.age)};
      setListing(current=>({...current,...savedListing,age:String(savedListing.age),birthDate,gender:currentUser.gender||'',interests:Array.isArray(currentUser.interests)?currentUser.interests.join(', '):'',goal:currentUser.goal||'both'}));
      setListingMediaUrl(savedListing.media_url || ''); setListingMediaType(savedListing.media_type || 'image');
      setListingStep(1);
      const discovery=await request('/api/discover'); setPeople(discovery.people||[]);
      setNotice('Профиль сохранён, анкета отправлена на проверку. Она появится в ленте после одобрения.');
      setTab('listing');
    } catch(e) { setError(e.message||'Не удалось создать профиль.'); }
    finally { setPublishing(false); }
  }

  function continueListingWizard() {
    setError('');
    if (listingStep === 1) {
      if (listing.name.trim().length < 2 || !listing.birthDate || listing.city.trim().length < 2 || listing.country.trim().length < 2) {
        setError('Укажи имя, дату рождения, город и страну. Имя — не короче 2 символов.');
        return;
      }
      setListingStep(2);
      return;
    }
    if (listingStep === 2) {
      if (listing.description.trim().length < 5) {
        setError('Добавь описание о себе (минимум 5 символов).');
        return;
      }
      setListingStep(3);
    }
  }

  async function skip(person) {
    // Hiding a card is only a local action; it does not create a like.
    setPeople(current => current.filter(p => String(p.id) !== String(person.id)));
  }

  const isMutualMatch = personId => mutualIds.includes(String(personId));

  const normalizedFeedSearch = feedSearch.trim().toLocaleLowerCase();
  const cityOptions = [...new Set(people.map(person => person.city).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const countryOptions = [...new Set(people.map(person => person.country).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const interestOptions = [...new Set(people.flatMap(person => [...(person.interests || []), ...(person.hobbies || '').split(/[,;\n]/).map(value => value.trim())]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filteredPeople = people.filter(person => {
    const searchable = [person.name, person.username, person.city, person.country, person.description, person.bio, person.hobbies, ...(person.interests || [])]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    const matchesSearch = !normalizedFeedSearch || searchable.includes(normalizedFeedSearch);
    const matchesCity = feedCity === 'all' || person.city === feedCity;
    const matchesCountry = feedCountry === 'all' || person.country === feedCountry;
    const matchesGoal = feedGoal === 'all' || person.goal === feedGoal || person.goal === 'both';
    const personInterests = [...(person.interests || []), ...(person.hobbies || '').split(/[,;\n]/).map(value => value.trim())].filter(Boolean).map(value => value.toLocaleLowerCase());
    const matchesInterest = feedInterest === 'all' || personInterests.includes(feedInterest.toLocaleLowerCase());
    return matchesSearch && matchesCity && matchesCountry && matchesGoal && matchesInterest;
  });
  const profileCompletionItems = [
    { label: 'Фото профиля', done: Boolean(profile.photoUrl || user?.photo_url) },
    { label: 'Город', done: Boolean(profile.city.trim()) },
    { label: 'Описание', done: Boolean(profile.bio.trim()) },
    { label: 'Интересы', done: Boolean(profile.interests.split(',').some(value => value.trim())) },
    { label: 'Цель общения', done: Boolean(profile.goal) }
  ];
  const profileCompletion = Math.round(profileCompletionItems.filter(item => item.done).length / profileCompletionItems.length * 100);
  const dailyPrompts = {
    ru: ['Какую песню ты можешь слушать бесконечно?', 'Как выглядит твой идеальный выходной?', 'Какое увлечение ты хотел бы попробовать?', 'Какой фильм ты советуешь всем посмотреть?'],
    de: ['Welches Lied könntest du endlos hören?', 'Wie sieht dein perfekter freier Tag aus?', 'Welches Hobby möchtest du ausprobieren?', 'Welchen Film würdest du allen empfehlen?'],
    en: ['What song could you listen to forever?', 'What does your perfect day off look like?', 'What hobby would you like to try?', 'Which film would you recommend to everyone?']
  };
  const weeklyThemes = {
    ru: [{ title: 'Музыка', subtitle: 'Поделись тем, что у тебя на повторе' }, { title: 'Игры', subtitle: 'Найди людей с похожими интересами' }, { title: 'Творчество', subtitle: 'Покажи, что тебя вдохновляет' }, { title: 'Кино и сериалы', subtitle: 'Обсуди любимые истории' }],
    de: [{ title: 'Musik', subtitle: 'Teile, was bei dir gerade läuft' }, { title: 'Gaming', subtitle: 'Finde Menschen mit ähnlichen Interessen' }, { title: 'Kreativität', subtitle: 'Zeig, was dich inspiriert' }, { title: 'Filme & Serien', subtitle: 'Sprich über deine Lieblingsgeschichten' }],
    en: [{ title: 'Music', subtitle: 'Share what is on repeat for you' }, { title: 'Gaming', subtitle: 'Find people with similar interests' }, { title: 'Creativity', subtitle: 'Show what inspires you' }, { title: 'Films & series', subtitle: 'Talk about your favourite stories' }]
  };
  const dayIndex = Math.floor(Date.now() / 86400000);
  const weekIndex = Math.floor(dayIndex / 7);

  if (maintenance) return <main className="app-shell"><section className="panel" style={{margin:'10vh auto',maxWidth:560,textAlign:'center',padding:28}}><div style={{fontSize:48}}>🔒</div><h1>VIBE временно закрыт</h1><p style={{whiteSpace:'pre-wrap',lineHeight:1.6}}>{maintenance.reason || 'Проект временно недоступен.'}</p><p>Пожалуйста, попробуйте зайти позже.</p></section></main>;
  if (user?.account_status === 'banned') return <main className={tab === 'discover' ? 'app-shell feed-mode' : 'app-shell'}><section className="panel" role="alert" style={{margin:'10vh auto',maxWidth:560,textAlign:'center'}}><div className="panel-icon"><ShieldAlert/></div><h1>Ваш аккаунт забанен</h1><p>Доступ к VIBE закрыт.</p><p><b>Кем заблокирован:</b> {user.ban_issuer_label || (user.ban_issuer === 'developer' ? 'разработчиком' : 'модератором')}</p><p><b>Причина:</b> {user.moderation_note || user.reason || 'Причина не указана'}</p></section></main>;
  if (['restricted','suspended'].includes(user?.account_status)) return <main className="app-shell"><section className="panel account-restriction-screen" role="alert"><div className="panel-icon"><ShieldAlert/></div><h1>{({ru:'Доступ временно ограничен',de:'Zugang vorübergehend eingeschränkt',en:'Access temporarily restricted'})[language]}</h1><p>{({ru:'Некоторые функции VIBE недоступны для этого аккаунта.',de:'Einige VIBE-Funktionen sind für dieses Konto nicht verfügbar.',en:'Some VIBE features are unavailable for this account.'})[language]}</p><p><b>{({ru:'Причина:',de:'Grund:',en:'Reason:'})[language]}</b> {user.moderation_note || user.reason || ({ru:'Причина не указана',de:'Kein Grund angegeben',en:'No reason provided'})[language]}</p><a className="save" href="https://t.me/iBEDatig_Bot" target="_blank" rel="noopener noreferrer">{({ru:'Обратиться в поддержку VIBE',de:'VIBE-Support kontaktieren',en:'Contact VIBE support'})[language]}</a></section></main>;
  if (!initData) return <Landing />;
  return <main className={tab === 'discover' ? 'app-shell feed-mode' : 'app-shell'}>
    <header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><span className="online"><i/> {user ? 'Telegram подключён' : 'знакомства'}</span><LanguagePicker/><button className="avatar" aria-label="Открыть мой профиль" onClick={() => setProfileOpen(true)}>{user?.photo_url ? <img src={user.photo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/> : (user?.first_name || 'Я').slice(0, 1)}</button></header>
    <section className="hero"><div className="eyebrow"><Sparkles size={14}/> ТВОЯ ВОЛНА</div><h1>Люди, с которыми<br/><span>совпадает вайб.</span></h1><p>Настоящие анкеты пользователей VIBE — без выдуманных профилей.</p><button type="button" className="save invite-button" onClick={() => { const inviteMessages = { en: 'Join VIBE on Telegram — discover people, friendship and conversation 💜', de: 'Entdecke VIBE auf Telegram — neue Menschen, Freundschaft und Gespräche 💜', ru: 'Открой VIBE в Telegram — знакомства, дружба и общение 💜' }; const referralLink = 'https://t.me/iBEDatig_Bot?start=ref_' + encodeURIComponent(user?.account_code || ''); const shareUrl = 'https://t.me/share/url?url=' + encodeURIComponent(referralLink) + '&text=' + encodeURIComponent(inviteMessages[language] || inviteMessages.en); if (webApp?.openTelegramLink) webApp.openTelegramLink(shareUrl); else window.open(shareUrl, '_blank', 'noopener,noreferrer'); }}><Share2 size={16}/> Пригласить друзей</button>{user && <p className="invite-count">{({ru:'Успешных приглашений:',de:'Erfolgreiche Einladungen:',en:'Successful invites:'})[language] || 'Successful invites:'} <strong>{referralCount}</strong></p>}</section>
    <nav className="tabs"><button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass size={17}/> Знакомства</button><button className={tab === 'likes' ? 'active' : ''} onClick={async () => { setTab('likes'); try { const data = await request('/api/likes'); const incomingLikes = data.incoming || []; const outgoingLikes = data.outgoing || []; setLikesData({incoming:incomingLikes,outgoing:outgoingLikes}); setMutualIds(incomingLikes.filter(person => outgoingLikes.some(other => String(other.id) === String(person.id))).map(person => String(person.id))); } catch(e) { setError(e.message); } }}><Heart size={17}/> Симпатии <span className="tab-count">{likesData.incoming.length}</span></button><button className={tab === 'listing' ? 'active' : ''} onClick={() => { setProfileOpen(false); setTab('listing'); }}><PlusCircle size={17}/> Моя анкета</button><button className={tab === 'chats' || tab === 'chat' ? 'active' : ''} onClick={() => { setTab('chats'); refreshChats(); }}><MessageCircle size={17}/> Чаты <span className="tab-count">{chats.length}</span></button></nav>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    {error && /Для взрослой возрастной группы сначала требуется подтверждение возраста\\.|Age verification is required before accessing the adults-only area\\.|Vor dem Zugang zum Erwachsenenbereich ist eine Altersprüfung erforderlich\\./i.test(error) ? <div className="report-overlay" role="presentation"><section className="panel report-dialog" role="dialog" aria-modal="true" aria-labelledby="age-verification-title"><div className="panel-icon"><Lock size={22}/></div><h2 id="age-verification-title">{({ru:'Подтверждение возраста 18+',de:'Altersprüfung für 18+',en:'Age verification for 18+'})[language] || 'Age verification for 18+'}</h2><p>{({ru:'Для доступа к взрослой группе VIBE необходимо пройти ручную проверку возраста.',de:'Für den Zugang zum Erwachsenenbereich von VIBE ist eine manuelle Altersprüfung erforderlich.',en:'Manual age verification is required to access the VIBE adults-only area.'})[language] || 'Manual age verification is required to access the VIBE adults-only area.'}</p><p>{({ru:'Нажмите кнопку ниже, чтобы обратиться в поддержку VIBE через бота. После рассмотрения заявки вы получите уведомление о результате.',de:'Tippe unten, um den VIBE-Support über den Bot zu kontaktieren. Du erhältst eine Benachrichtigung, sobald deine Anfrage geprüft wurde.',en:'Tap the button below to contact VIBE Support through the bot. You will be notified when your request has been reviewed.'})[language] || 'Tap the button below to contact VIBE Support through the bot. You will be notified when your request has been reviewed.'}</p><p className="field-hint">{({ru:'До подтверждения возраста доступ к взрослой группе закрыт.',de:'Der Zugang zum Erwachsenenbereich bleibt bis zur Altersbestätigung gesperrt.',en:'Access to the adults-only area remains locked until your age is verified.'})[language] || 'Access to the adults-only area remains locked until your age is verified.'}</p><a className="save" href="https://t.me/iBEDatig_Bot" target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',textDecoration:'none',width:'100%',boxSizing:'border-box'}}>{({ru:'Связаться с поддержкой VIBE',de:'VIBE-Support kontaktieren',en:'Contact VIBE Support'})[language] || 'Contact VIBE Support'}</a><button className="skip" type="button" style={{width:'100%',marginTop:10}} onClick={()=>setError('')}>{({ru:'Закрыть',de:'Schließen',en:'Close'})[language] || 'Close'}</button></section></div> : <div className="notice" role="alert"><ShieldAlert size={16}/><span>{error}</span><button onClick={loadApp} title="Повторить"><RefreshCw size={15}/></button></div>}
    {loading && <div className="panel"><p>Подключаем VIBE…</p></div>}
    {!loading && tab === 'discover' && <section className="people tiktok-feed">
      <button type="button" className="feed-filter-trigger" onClick={()=>setFiltersOpen(open=>!open)} aria-label="Открыть фильтры" aria-expanded={filtersOpen}><SlidersHorizontal size={19}/><span>Фильтры</span></button>
      {filtersOpen && <div className="feed-filter-overlay" role="dialog" aria-modal="true" aria-label="Фильтры анкет"><div className="feed-filter-heading"><div><span className="inspiration-kicker"><SlidersHorizontal size={13}/> VIBE DISCOVERY</span><h3>Настрой ленту</h3></div><button type="button" className="chat-safety-button" onClick={()=>setFiltersOpen(false)} aria-label="Закрыть фильтры"><X size={18}/></button></div><label className="feed-search"><Compass size={17}/><input value={feedSearch} onChange={e=>setFeedSearch(e.target.value)} placeholder="Имя, интерес или описание" aria-label="Поиск по анкетам"/></label><label className="feed-city-filter"><MapPin size={16}/><select value={feedCity} onChange={e=>setFeedCity(e.target.value)} aria-label="Город"><option value="all">Все города</option>{cityOptions.map(city=><option key={city} value={city}>{city}</option>)}</select></label><label className="feed-city-filter"><Compass size={16}/><select value={feedCountry} onChange={e=>setFeedCountry(e.target.value)} aria-label="Страна"><option value="all">Все страны</option>{countryOptions.map(country=><option key={country} value={country}>{country}</option>)}</select></label><label className="feed-city-filter"><Heart size={16}/><select value={feedGoal} onChange={e=>setFeedGoal(e.target.value)} aria-label="Цель общения"><option value="all">Все цели</option><option value="friendship">Дружба</option><option value="chat">Общение</option><option value="relationship">Отношения</option></select></label><label className="feed-city-filter"><Sparkles size={16}/><select value={feedInterest} onChange={e=>setFeedInterest(e.target.value)} aria-label="Интерес"><option value="all">Все интересы</option>{interestOptions.map(interest=><option key={interest} value={interest}>{interest}</option>)}</select></label><div className="feed-filter-actions"><button type="button" className="skip" onClick={()=>{setFeedSearch('');setFeedCity('all');setFeedCountry('all');setFeedGoal('all');setFeedInterest('all');}}>Сбросить</button><button type="button" className="save" onClick={()=>setFiltersOpen(false)}>Показать {filteredPeople.length} анкет</button></div></div>}
      <div className="feed-topline"><div><span className="feed-kicker"><Sparkles size={13}/> VIBE FEED</span><h2>Лента для тебя</h2><p>Найди людей по интересам, городу и цели общения.</p></div><span className="count">{filteredPeople.length} / {people.length}</span><button type="button" className="skip feed-exit" onClick={() => setTab("chats")} aria-label="Выйти из ленты анкет">× В меню</button></div>
      <div className="discovery-inspiration-grid">
        <article className="daily-prompt-card"><span className="inspiration-kicker"><Sparkles size={13}/> {({ru:'ВОПРОС ДНЯ',de:'FRAGE DES TAGES',en:'QUESTION OF THE DAY'})[language]}</span><p>{(dailyPrompts[language] || dailyPrompts.en)[dayIndex % dailyPrompts.en.length]}</p><button type="button" onClick={() => { setTab('listing'); setListingStep(2); setNotice(({ru:'Вопрос дня: ',de:'Frage des Tages: ',en:'Question of the day: '})[language] + (dailyPrompts[language] || dailyPrompts.en)[dayIndex % dailyPrompts.en.length] + ({ru:' — добавь свой ответ в описание анкеты.',de:' — schreibe deine Antwort in die Profilbeschreibung.',en:' — add your answer to your profile description.'})[language]); }}>{({ru:'Ответить в анкете',de:'Im Profil beantworten',en:'Answer in your profile'})[language]} <ArrowRight size={14}/></button></article>
        <article className="weekly-theme-card"><span className="inspiration-kicker"><Sparkles size={13}/> {({ru:'ТЕМА НЕДЕЛИ',de:'THEMA DER WOCHE',en:'WEEKLY THEME'})[language]}</span><h3>{(weeklyThemes[language] || weeklyThemes.en)[weekIndex % weeklyThemes.en.length].title}</h3><p>{(weeklyThemes[language] || weeklyThemes.en)[weekIndex % weeklyThemes.en.length].subtitle}</p><button type="button" onClick={() => { setFeedSearch((weeklyThemes[language] || weeklyThemes.en)[weekIndex % weeklyThemes.en.length].title); setFeedInterest('all'); }}>{({ru:'Найти по теме',de:'Passende Profile finden',en:'Explore this theme'})[language]} <ArrowRight size={14}/></button></article>
      </div>
      <div className="feed-tools" role="search">
        <label className="feed-search"><Compass size={17} aria-hidden="true"/><input value={feedSearch} onChange={e=>setFeedSearch(e.target.value)} placeholder="Поиск по имени, интересам или описанию" aria-label="Поиск по анкетам"/></label>
        <label className="feed-city-filter"><MapPin size={16} aria-hidden="true"/><select value={feedCity} onChange={e=>setFeedCity(e.target.value)} aria-label="Фильтр по городу"><option value="all">Все города</option>{cityOptions.map(city=><option key={city} value={city}>{city}</option>)}</select></label>
        <label className="feed-city-filter"><Compass size={16} aria-hidden="true"/><select value={feedCountry} onChange={e=>setFeedCountry(e.target.value)} aria-label="Фильтр по стране"><option value="all">Все страны</option>{countryOptions.map(country=><option key={country} value={country}>{country}</option>)}</select></label>
        <label className="feed-city-filter"><Heart size={16} aria-hidden="true"/><select value={feedGoal} onChange={e=>setFeedGoal(e.target.value)} aria-label="Цель знакомства"><option value="all">Все цели</option><option value="friendship">Дружба</option><option value="chat">Общение</option><option value="relationship">Отношения</option></select></label>
        <label className="feed-city-filter"><Sparkles size={16} aria-hidden="true"/><select value={feedInterest} onChange={e=>setFeedInterest(e.target.value)} aria-label="Интересы"><option value="all">Все интересы</option>{interestOptions.map(interest=><option key={interest} value={interest}>{interest}</option>)}</select></label>
        {(feedSearch || feedCity !== 'all' || feedCountry !== 'all' || feedGoal !== 'all' || feedInterest !== 'all') && <button type="button" className="feed-reset" onClick={()=>{setFeedSearch('');setFeedCity('all');setFeedCountry('all');setFeedGoal('all');setFeedInterest('all');}}>Сбросить</button>}
      </div>
      {people.length === 0 && <div className="empty"><Sparkles/><h3>Лента пока пуста</h3><p>Публикации появятся, когда пользователи добавят фото или видео и их анкеты будут одобрены.</p><button className="save" onClick={() => setTab('listing')}><PlusCircle size={16}/> Добавить публикацию</button></div>}
      {people.length > 0 && filteredPeople.length === 0 && <div className="empty feed-no-results"><Compass/><h3>Ничего не найдено</h3><p>Попробуй изменить поисковый запрос или выбрать другой город.</p><button className="skip" onClick={()=>{setFeedSearch('');setFeedCity('all');}}>Сбросить фильтры</button></div>}
      {filteredPeople.length > 0 && <div className="feed-scroll" >
      {filteredPeople.map((p,i) => <article className="feed-post" key={p.id} data-index={i} >
        <div className="feed-media">
          {(p.media_type === 'video' && p.media_url) ? <video className="feed-media-asset" src={p.media_url} controls playsInline loop muted preload="metadata"/> :
            (p.media_url || p.photo_url) ? <img className="feed-media-asset" src={p.media_url || p.photo_url} alt={'Публикация: ' + (p.name || 'пользователь')}/> :
            <div className="profile-cover-placeholder feed-placeholder"><span>{(p.name || '?').slice(0,1).toUpperCase()}</span><small>ТВОЙ ВАЙБ. ТВОЯ ИСТОРИЯ.</small></div>}
          <div className="feed-media-shade"/>
          <div className="feed-profile-copy"><div className="feed-identity"><button className="feed-name" onClick={()=>setViewingProfile(p)}>{p.name || 'Пользователь'}{p.age ? ', '+p.age : ''}</button><RoleBadge role={p.public_role} label={p.role_label}/></div><span className="profile-location"><MapPin size={13}/>{[p.city,p.country].filter(Boolean).join(', ') || 'Местоположение не указано'}</span>{p.hobbies && <p className="feed-hobbies"><strong>Хобби</strong> {p.hobbies}</p>}<p className="feed-description">{p.description || p.bio || 'Пока ничего не рассказал о себе.'}</p>{((p.interests || []).length>0 || p.hobbies) && <div className="profile-interests">{[...(p.interests || []), ...(p.hobbies ? p.hobbies.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean) : [])].filter((x,i,a)=>x && a.indexOf(x)===i).slice(0,5).map(x=><span key={x}>#{x}</span>)}</div>}</div>
          <div className="feed-action-rail">
            <button className={String(p.id)===String(user?.id)?'own-profile-like':likesData.outgoing.some(item=>String(item.id)===String(p.id))?'already-liked':''} onClick={()=>{if(String(p.id)!==String(user?.id)||user?.public_role==='developer')like(p)}} disabled={(String(p.id)===String(user?.id)&&user?.public_role!=='developer')||likingIds.includes(String(p.id))||likesData.outgoing.some(item=>String(item.id)===String(p.id))} aria-label={String(p.id)===String(user?.id)?'Тестовая симпатия разработчика':likesData.outgoing.some(item=>String(item.id)===String(p.id))?'Симпатия уже отправлена':'Поставить лайк'} title={String(p.id)===String(user?.id)?'Тестовая симпатия разработчика':likesData.outgoing.some(item=>String(item.id)===String(p.id))?'Симпатия уже отправлена':'Лайк'}><Heart size={25} fill="currentColor"/><span>{String(p.id)===String(user?.id)?(likingIds.includes(String(p.id))?'Отправляем…':'Тест лайка'):likingIds.includes(String(p.id))?'Отправляем…':likesData.outgoing.some(item=>String(item.id)===String(p.id))?'Отправлено':'Лайк'}</span></button>
            {(String(p.id)!==String(user?.id)||user?.public_role==='developer') && <><button onClick={()=>openChat({user_id:p.id,first_name:p.name||'Пользователь',photo_url:p.photo_url})} aria-label="Написать автору в личные сообщения" title="Написать автору"><MessageCircle size={24}/><span>Чат</span></button>{String(p.id)!==String(user?.id) && <button onClick={()=>{setReportingPerson(p);setReportType('post');setReportReason('');setReportDetails('');setReporterUsername(user?.username?'@'+user.username:'');setReportedUsername(p.username?'@'+p.username:'');setReportEvidence('');setReportEvidenceName('');}} aria-label="Пожаловаться на публикацию" title="Пожаловаться"><Flag size={23}/><span>Жалоба</span></button>}</>}
          </div>
        </div>
        <div className="feed-post-footer"><span>@{(p.username || p.name || 'vibe').replace(/^@/,'')}</span><button onClick={()=>setViewingProfile(p)}>Профиль <ArrowRight size={14}/></button><span>{i+1} / {people.length}</span></div>
      </article>)}
      </div>}
    </section>}
    {viewingProfile && <div className="report-overlay profile-fullscreen-overlay" onClick={e=>{if(e.target===e.currentTarget)setViewingProfile(null);}}><section className="panel report-dialog profile-fullscreen-dialog"><button className="back-chat" onClick={() => setViewingProfile(null)}>← Назад</button><h2>{viewingProfile.name || 'Пользователь'}{viewingProfile.age ? ', ' + viewingProfile.age : ''}</h2><p className="profile-handle">{viewingProfile.username ? '@'+viewingProfile.username : 'Пользователь VIBE'} · анкета #{viewingProfile.listing_id || '—'}</p><RoleBadge role={viewingProfile.public_role} label={viewingProfile.role_label}/>{viewingProfile.media_type==='video'&&viewingProfile.media_url ? <video src={viewingProfile.media_url} controls playsInline style={{width:'100%',maxHeight:360,borderRadius:14,background:'#0f0d16',margin:'14px 0'}}/> : (viewingProfile.media_url||viewingProfile.photo_url) ? <img src={viewingProfile.media_url||viewingProfile.photo_url} alt="Медиа анкеты" style={{width:'100%',maxHeight:320,objectFit:'contain',borderRadius:14,background:'#0f0d16',margin:'14px 0'}}/> : null}<div className="full-profile-details"><p><b>Город и страна</b><span>{[viewingProfile.city,viewingProfile.country].filter(Boolean).join(', ') || 'Не указаны'}</span></p><p><b>О себе</b><span>{viewingProfile.description || viewingProfile.bio || 'Описание не добавлено.'}</span></p><p><b>Хобби и занятия</b><span>{viewingProfile.hobbies || (viewingProfile.interests || []).join(', ') || 'Не указаны'}</span></p><p><b>Интересы</b><span>{(viewingProfile.interests || []).join(', ') || 'Не указаны'}</span></p></div>{(String(viewingProfile.id) !== String(user?.id)||user?.public_role==='developer') && <div className="profile-actions"><button className="like" onClick={() => { const person = viewingProfile; setViewingProfile(null); like(person); }}><Heart size={17} fill="currentColor"/> {String(viewingProfile.id)===String(user?.id)?'Тест лайка':'Поставить лайк'}</button><button className="save" onClick={() => openChat({user_id:viewingProfile.id,first_name:viewingProfile.name || 'Пользователь',photo_url:viewingProfile.photo_url})} title="Написать автору"><MessageCircle size={17}/> {String(viewingProfile.id)===String(user?.id)?'Тест чата':'Чат'}</button>{String(viewingProfile.id)!==String(user?.id) && !viewingProfile.is_test_profile && <button className="skip" onClick={() => { setReportingPerson(viewingProfile); setReportType('profile'); setReportReason(''); setReportDetails(''); setReporterUsername(user?.username?'@'+user.username:''); setReportedUsername(viewingProfile.username?'@'+viewingProfile.username:''); setReportEvidence(''); setReportEvidenceName(''); setViewingProfile(null); }}>Пожаловаться</button>}</div>}</section></div>}


    {!loading && tab === 'likes' && <section className="panel likes-panel">
      <div className="panel-heading-row"><div className="panel-icon"><Heart/></div><span className="panel-kicker">ТВОЙ VIBE</span></div><h2>Симпатии</h2>
      <p>Посмотри, кто поставил тебе лайк, и управляй своими симпатиями.</p>
      <h3>Тебе поставили лайк · {likesData.incoming.length}</h3>
      {likesData.incoming.length===0 ? <p className="field-hint">Пока нет новых симпатий. Продолжай знакомиться в ленте.</p> : likesData.incoming.map(person=><div className="chat-row" key={'in-'+person.id}>
        <span className="chat-avatar">{person.photo_url?<img src={person.photo_url} alt="" loading="lazy"/>:(person.name||'?').slice(0,1)}</span>
        <span className="chat-row-copy"><b>{person.name}{person.age?', '+person.age:''}</b><small>{[person.city,person.country].filter(Boolean).join(', ')||'VIBE'}</small></span>
        {mutualIds.includes(String(person.id)) ? <span className="mutual-status"><Heart size={14} fill="currentColor"/> Взаимно</span> : <button className="like" disabled={likingIds.includes(String(person.id))} onClick={()=>like(person)}><Heart size={15} fill="currentColor"/> {likingIds.includes(String(person.id))?'Отправляем…':'Ответить'}</button>}
      </div>)}
      <h3 style={{marginTop:24}}>Ты поставил лайк · {likesData.outgoing.length}</h3>
      {likesData.outgoing.length===0 ? <p className="field-hint">Здесь появятся анкеты, которым ты поставишь лайк.</p> : likesData.outgoing.map(person=><div className="chat-row" key={'out-'+person.id}>
        <span className="chat-avatar">{person.photo_url?<img src={person.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>:(person.name||'?').slice(0,1)}</span>
        <span className="chat-row-copy"><b>{person.name}{person.age?', '+person.age:''}</b><small>{[person.city,person.country].filter(Boolean).join(', ')||'VIBE'}</small></span>
        <button className="save" onClick={()=>openChat({user_id:person.id,first_name:person.name||'Пользователь',photo_url:person.photo_url})}><MessageCircle size={15}/> Написать</button>
      </div>)}
      <button className="save" style={{marginTop:18}} onClick={() => { setTab('chats'); refreshChats(); }}>Открыть чаты <MessageCircle size={16}/></button>
    </section>}
    {!loading && tab === 'chats' && <section className="panel chat-list-panel"><div className="panel-heading-row"><div className="panel-icon"><MessageCircle/></div><span className="panel-kicker">НА СВЯЗИ</span></div><h2>Твои чаты</h2><p>Переписывайся напрямую с людьми из ленты VIBE.</p>{chats.length === 0 ? <div className="empty"><Heart/><h3>Пока нет чатов</h3><p>Открой ленту и нажми «ЛС» у понравившегося человека, чтобы начать разговор.</p></div> : chats.map(chat => <button className="chat-row" key={chat.user_id} onClick={() => openChat(chat)}><span className="chat-avatar">{chat.photo_url ? <img src={chat.photo_url} alt="" loading="lazy"/> : (chat.first_name || '?').slice(0,1)}</span><span className="chat-row-copy"><b>{chat.first_name}</b><small>{chat.last_message || 'Начни разговор 👋'}</small></span><MessageCircle size={18}/></button>)}</section>}
    {!loading && tab === 'chat' && activeChat && <section className="panel chat-panel"><button className="back-chat" onClick={() => { setTab('chats'); refreshChats(); }}>← Все чаты</button><div className="chat-conversation-heading"><span className="chat-avatar">{activeChat.photo_url ? <img src={activeChat.photo_url} alt="" loading="lazy"/> : (activeChat.first_name || '?').slice(0,1)}</span><div><h2>{activeChat.first_name}</h2><p>{String(activeChat.user_id).startsWith('vibe-test-') ? 'ТЕСТОВЫЙ ДЕМО-ЧАТ — не реальный пользователь' : 'Личные сообщения VIBE · возрастные группы разделены'}</p></div><div className="chat-safety-actions">{!String(activeChat.user_id).startsWith('vibe-test-') && <><button type="button" className="chat-safety-button" title="Пожаловаться" aria-label="Пожаловаться" onClick={()=>{setReportingPerson({id:activeChat.user_id,name:activeChat.first_name||'Пользователь',username:activeChat.username||'',photo_url:activeChat.photo_url});setReportType('profile');setReportReason('');setReportDetails('');setReporterUsername(user?.username?'@'+user.username:'');setReportedUsername(activeChat.username?'@'+activeChat.username:'');setReportEvidence('');setReportEvidenceName('');}}><Flag size={17}/></button><button type="button" className="chat-safety-button danger" title="Заблокировать" aria-label="Заблокировать" onClick={async()=>{if(!window.confirm('Заблокировать пользователя? Он не сможет писать тебе, а вы исчезнете из рекомендаций друг друга.'))return;try{await request('/api/blocks/'+encodeURIComponent(activeChat.user_id),{method:'POST'});setChats(current=>current.filter(chat=>String(chat.user_id)!==String(activeChat.user_id)));setMessages([]);setActiveChat(null);setTab('chats');setNotice('Пользователь заблокирован.');}catch(e){setError(e.message||'Не удалось заблокировать пользователя.');}}}><ShieldAlert size={17}/></button></>}</div></div><div className="messages-list">{messages.map(message => <div className={'message-bubble ' + (String(message.sender_id) === String(user?.id) ? 'mine' : '')} key={message.id}><p>{message.body}</p>{message.test_mode && <small>ТЕСТ · не доставлено реальному пользователю</small>}<small>{new Date(message.created_at).toLocaleString()}</small></div>)}{messages.length>0&&messages.every(message=>String(message.sender_id)===String(user?.id))&&!String(activeChat.user_id).startsWith('vibe-test-')&&<p className="first-message-hint">Первое сообщение отправлено. Дождись ответа — до этого нельзя отправлять повторные сообщения.</p>}<div ref={messagesEndRef}/></div><form className="chat-compose" onSubmit={sendMessage}><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} placeholder="Напиши сообщение…" required disabled={sendingMessage}/><button className="like" type="submit" disabled={sendingMessage || !draft.trim()} aria-label="Отправить сообщение">{sendingMessage ? <RefreshCw size={17} className="spin"/> : <ArrowRight size={17}/>}</button></form></section>}
    {!loading && tab === 'listing' && <section className="panel profile-panel listing-wizard">
      <div className="listing-wizard-heading">
        <span className="listing-wizard-icon"><PlusCircle size={22}/></span>
        <div><span className="feed-kicker">ТВОЯ ИСТОРИЯ</span><h2>{listingStep===1?'Начнём с основ':listingStep===2?'Расскажи о себе':'Последний шаг'}</h2><p>Создай понятную, настоящую анкету. Перед публикацией её проверит модерация.</p></div>
      </div>
      <div className="listing-stepper" aria-label="Шаг создания анкеты">
        {[{n:1,label:'Основное'},{n:2,label:'О тебе'},{n:3,label:'Медиа и отправка'}].map(step=><div key={step.n} className={'listing-step '+(listingStep===step.n?'current':listingStep>step.n?'complete':'')}><span>{listingStep>step.n?'✓':step.n}</span><small>{step.label}</small></div>)}
      </div>
      <form onSubmit={listingStep===3?publishListing:e=>{e.preventDefault();continueListingWizard();}}>
        {listingStep===1 && <div className="listing-step-content">
          <label>Как тебя показывать?<input autoFocus value={listing.name} onChange={e=>setListing({...listing,name:e.target.value})} minLength={2} maxLength={60} placeholder="Имя или никнейм" required/></label>
          <label>Дата рождения<input type="date" value={listing.birthDate} max={new Date().toISOString().slice(0,10)} onChange={e=>setListing({...listing,birthDate:e.target.value})} required/><span className="field-hint">Нужна для возрастной группы и безопасности. В ленте показывается возраст, а не дата рождения.</span></label>
          <label>Пол<select value={listing.gender} onChange={e=>setListing({...listing,gender:e.target.value})}><option value="">Не хочу указывать</option><option value="woman">Женский</option><option value="man">Мужской</option><option value="nonbinary">Небинарный</option><option value="prefer_not_to_say">Предпочитаю не указывать</option></select></label>
          <div className="listing-two-columns">
            <label>Город<input value={listing.city} onChange={e=>setListing({...listing,city:e.target.value})} minLength={2} maxLength={80} placeholder="Например, Берлин" required/></label>
            <label>Страна<input value={listing.country} onChange={e=>setListing({...listing,country:e.target.value})} minLength={2} maxLength={80} placeholder="Германия" required/></label>
          </div>
          <div className="listing-info-note"><MapPin size={17}/><span>Указывай только город и страну — не публикуй адрес, школу или другие точные данные о местоположении.</span></div>
          <button className="save listing-next" type="submit">Продолжить <ArrowRight size={17}/></button>
        </div>}
        {listingStep===2 && <div className="listing-step-content">
          <label>Цель знакомства<select value={listing.goal} onChange={e=>setListing({...listing,goal:e.target.value})}><option value="both">Общение и отношения</option><option value="friendship">Дружба</option><option value="chat">Общение</option><option value="relationship">Отношения</option></select></label>
          <label>Твои интересы<textarea autoFocus value={listing.interests} onChange={e=>setListing({...listing,interests:e.target.value})} maxLength={500} placeholder="Музыка, игры, кино, спорт…"/></label>
          <div className="interest-suggestions onboarding-interest-suggestions"><span>Выбери то, что тебе нравится</span><div>{['Музыка','Игры','Кино','Спорт','Книги','Природа','Технологии','Рисование','Путешествия','Животные','Фотография','Танцы'].map(interest=><button key={interest} type="button" className={listing.interests.split(',').map(value=>value.trim().toLocaleLowerCase()).includes(interest.toLocaleLowerCase())?'selected':''} onClick={()=>setListing(current=>{const values=current.interests.split(',').map(value=>value.trim()).filter(Boolean);const exists=values.some(value=>value.toLocaleLowerCase()===interest.toLocaleLowerCase());return {...current,interests:(exists?values.filter(value=>value.toLocaleLowerCase()!==interest.toLocaleLowerCase()):[...values,interest]).slice(0,20).join(', ')};})}>{interest}</button>)}</div></div>
          <label>Немного о тебе<textarea value={listing.description} onChange={e=>setListing({...listing,description:e.target.value})} minLength={5} maxLength={1000} placeholder="Что тебе нравится? О чём интересно поговорить?" required/></label>
          <label>Хобби и занятия (необязательно)<textarea value={listing.hobbies} onChange={e=>setListing({...listing,hobbies:e.target.value})} maxLength={300} placeholder="Музыка, спорт, игры, рисование, прогулки…"/></label>
          <p className="field-hint">Не добавляй телефон, адрес, пароли или чужие личные данные. Оскорбления и сексуализированный контент запрещены.</p>
          <div className="listing-wizard-actions"><button className="skip" type="button" onClick={()=>{setListingStep(1);setError('');}}>Назад</button><button className="save" type="submit">К фото <ArrowRight size={17}/></button></div>
        </div>}
        {listingStep===3 && <div className="listing-step-content">
          <div className="listing-age-summary"><span className="listing-age-icon"><ShieldCheck size={20}/></span><div><b>Возраст из профиля</b><p>{calculateAgeFromBirthDate(String(user?.birth_date||'').slice(0,10)) ?? '—'} лет · возраст не вводится вручную</p></div></div>
          <label>Фото или видео для ленты<span className="media-picker"><ImagePlus size={17}/>{listingMediaUrl ? 'Медиа выбрано · '+(listingMediaType==='video'?'видео':'фото') : 'Выбрать фото или видео'}<input type="file" accept="image/*,video/*" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const isVideo=file.type.startsWith('video/');if(!file.type.startsWith('image/')&&!isVideo){setError('Выбери фото или видео.');e.target.value='';return;}if(file.size>3*1024*1024){setError('Медиа должно быть не больше 3 МБ.');e.target.value='';return;}try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось прочитать медиа'));reader.readAsDataURL(file);});setListingMediaUrl(data);setListingMediaType(isVideo?'video':'image');setError('');setNotice('Медиа готово к отправке.');}catch(err){setError(err.message);}e.target.value='';}}/></span></label>
          {listingMediaUrl && <div className="listing-media-preview">{listingMediaType==='video'?<video src={listingMediaUrl} controls playsInline/>:<img src={listingMediaUrl} alt="Предпросмотр анкеты"/>}<button className="skip" type="button" onClick={()=>{setListingMediaUrl('');setListingMediaType('image');}}>Убрать медиа</button></div>}
          <div className="listing-review-card"><span className="listing-review-check"><ShieldCheck size={18}/></span><div><b>Что будет дальше?</b><p>Анкета уйдёт на проверку. Она появится в ленте других пользователей только после одобрения.</p></div></div>
          <div className="listing-wizard-actions"><button className="skip" type="button" onClick={()=>{setListingStep(2);setError('');}}>Назад</button><button className="save" type="submit" disabled={publishing}>{publishing?'Отправляем…':'Отправить на проверку'} <ArrowRight size={17}/></button></div>
        </div>}
      </form>
    </section>}
    {profileOpen && <div className="report-overlay" onClick={e => { if (e.target === e.currentTarget && user?.birth_date) setProfileOpen(false); }}><section className="panel report-dialog profile-modal account-profile-modal">{user?.birth_date && <button className="back-chat" type="button" onClick={() => setProfileOpen(false)}>← Закрыть профиль</button>}{!user?.birth_date && <p className="field-hint">Сначала заполни обязательные данные профиля. Без даты рождения продолжить нельзя.</p>}<div className="account-avatar">{user?.photo_url ? <img src={user.photo_url} alt="Аватар" /> : <UserRound size={42}/>}</div><h2>{user?.username ? '@' + user.username : (user?.first_name || 'Пользователь')}</h2><RoleBadge role={user?.public_role} label={user?.role_label}/><div className="account-profile-stats"><div><span>Код аккаунта</span><strong>{user?.account_code || String(user?.id || '').padStart(6,'0')}</strong></div><div><span>Симпатии</span><strong><Heart size={17} fill="currentColor"/> {user?.likes_received || 0}</strong></div></div><button type="button" className="skip profile-share-card" onClick={()=>{const inviteMessages={ru:'Присоединяйся к VIBE 💜 Дружба, общение и знакомства. Мой код аккаунта: '+(user?.account_code||''),de:'Entdecke VIBE 💜 Freundschaft, Gespräche und neue Kontakte. Mein Account-Code: '+(user?.account_code||''),en:'Join VIBE 💜 Friendship, conversation and new connections. My account code: '+(user?.account_code||'')};const referralLink='https://t.me/iBEDatig_Bot?start=ref_'+encodeURIComponent(user?.account_code||'');const shareUrl='https://t.me/share/url?url='+encodeURIComponent(referralLink)+'&text='+encodeURIComponent(inviteMessages[language]||inviteMessages.en);if(webApp?.openTelegramLink)webApp.openTelegramLink(shareUrl);else window.open(shareUrl,'_blank','noopener,noreferrer')}}><Share2 size={16}/> Поделиться карточкой VIBE</button>
      <form className="profile-panel profile-editor-form" onSubmit={saveProfile}>
        <h3>Настроить профиль</h3>
        <p className="field-hint">Эти данные помогают VIBE подбирать совместимые знакомства. Не указывай точный адрес.</p>
        <div className="profile-completion" aria-label={'Профиль заполнен на ' + profileCompletion + '%'}><div className="profile-completion-top"><span>Заполнение профиля</span><strong>{profileCompletion}%</strong></div><div className="profile-completion-track"><span style={{width: profileCompletion + '%'}}/></div><div className="profile-completion-checks">{profileCompletionItems.map(item=><span key={item.label} className={item.done?'is-complete':''}>{item.done?'✓':'○'} {item.label}</span>)}</div></div>
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
        <div className="interest-suggestions"><span>Популярные интересы</span><div>{['Музыка','Игры','Кино','Спорт','Книги','Природа','Технологии','Рисование'].map(interest=><button key={interest} type="button" className={profile.interests.split(',').map(value=>value.trim().toLocaleLowerCase()).includes(interest.toLocaleLowerCase())?'selected':''} onClick={()=>setProfile(current=>{const values=current.interests.split(',').map(value=>value.trim()).filter(Boolean);const exists=values.some(value=>value.toLocaleLowerCase()===interest.toLocaleLowerCase());return {...current,interests:(exists?values.filter(value=>value.toLocaleLowerCase()!==interest.toLocaleLowerCase()):[...values,interest]).slice(0,20).join(', ')};})}>{interest}</button>)}</div></div>
        <p className="field-hint">VIBE разделяет пользователей на подростковую сторону (14–17 лет) и взрослую сторону (18+). Доступ к взрослой стороне требует подтверждения возраста.</p>
        <button className="save" type="submit" disabled={saving || uploadingMedia || !profile.birthDate}><Lock size={15}/>{saving ? 'Сохраняем…' : 'Сохранить профиль'}</button>
        <button className="skip profile-public-listing-link" type="button" disabled={!user?.birth_date} onClick={() => { setProfileOpen(false); setTab('listing'); }}><PlusCircle size={15}/> Управлять публичной анкетой</button>
      </form>
      </section></div>}
    {reportingPerson && <div className="report-overlay" onClick={e=>{if(e.target===e.currentTarget){setReportingPerson(null);setError('');}}}><section className="panel report-dialog"><button className="back-chat" type="button" onClick={()=>{setReportingPerson(null);setError('');}}>← Назад</button><h2>Пожаловаться на {reportType === 'post' ? 'публикацию' : 'профиль'}</h2><p>Жалоба отправится модерации VIBE. Причина обязательна; доказательства можно приложить, если они есть.</p><form onSubmit={submitReport}><label>Обязательная причина<select value={reportReason} onChange={e=>setReportReason(e.target.value)} required><option value="" disabled>Выбери причину</option><option>Спам</option><option>Оскорбления или угрозы</option><option>Фейковая анкета</option><option>Неприемлемый контент</option><option>Подозрение на мошенничество</option><option>Преследование или угрозы безопасности</option><option>Другое</option></select></label><label>Подробности<textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} maxLength={1000} placeholder="Опиши, что произошло (необязательно)"/></label><label>Доказательства (необязательно)<span className="media-picker"><ImagePlus size={17}/>{reportEvidenceName || 'Прикрепить фото, видео или PDF'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){setError('Доказательство должно быть не больше 2 МБ.');e.target.value='';return;}const allowedTypes=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf'];if(!allowedTypes.includes(file.type)){setError('Поддерживаются JPG, PNG, WEBP, GIF, MP4, WEBM или PDF.');e.target.value='';return;}try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось прочитать файл'));reader.readAsDataURL(file);});setReportEvidence(data);setReportEvidenceName(file.name);setError('');}catch(err){setError(err.message);}e.target.value='';}}/></span></label>{reportEvidence && <button className="skip" type="button" onClick={()=>{setReportEvidence('');setReportEvidenceName('');}}>Убрать доказательство</button>}<button className="save" type="submit" disabled={reportSubmitting}>{reportSubmitting?'Отправляем…':'Отправить жалобу'}</button></form></section></div>}
    <nav className="mobile-nav" aria-label="Основная навигация"><button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass size={20}/><span>Поиск</span></button><button className={tab === 'likes' ? 'active' : ''} onClick={async () => { setTab('likes'); try { const data = await request('/api/likes'); const incomingLikes = data.incoming || []; const outgoingLikes = data.outgoing || []; setLikesData({incoming:incomingLikes,outgoing:outgoingLikes}); setMutualIds(incomingLikes.filter(person => outgoingLikes.some(other => String(other.id) === String(person.id))).map(person => String(person.id))); } catch(e) { setError(e.message); } }}><Heart size={20}/><span>Симпатии</span>{likesData.incoming.length > 0 && <i>{likesData.incoming.length}</i>}</button><button className={tab === 'chats' || tab === 'chat' ? 'active' : ''} onClick={() => { setTab('chats'); refreshChats(); }}><MessageCircle size={20}/><span>Чаты</span>{chats.length > 0 && <i>{chats.length}</i>}</button><button className={tab === 'listing' ? 'active' : ''} onClick={() => { setProfileOpen(false); setTab('listing'); }}><PlusCircle size={20}/><span>Моя анкета</span></button></nav>
    <footer><span>vibe. © 2026</span><span className="site-legal-links"><a href="/rules">Правила проекта</a><a href="/privacy">Конфиденциальность</a><Lock size={12}/> Безопасность важна</span></footer>
  </main>;
}


function Landing() {
  const [language,setLanguage] = useState(() => { try { const saved = localStorage.getItem('vibe-language'); return ['en','de','ru'].includes(saved) ? saved : 'en'; } catch { return 'en'; } });
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
  const [legalLanguage, setLegalLanguage] = useState(() => {
    try { return localStorage.getItem('vibe-language') || 'en'; } catch { return 'en'; }
  });
  const changeLegalLanguage = value => {
    if (!['en','de','ru'].includes(value)) return;
    setLegalLanguage(value);
    try { localStorage.setItem('vibe-language', value); } catch {}
    document.documentElement.lang = value;
    window.dispatchEvent(new CustomEvent('vibe-language-change',{detail:value}));
  };
  const title = privacy ? (legalLanguage === 'de' ? 'Datenschutzerklärung' : legalLanguage === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy') : 'Правила проекта';
  return <main className="app-shell legal-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="VIBE — главная"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></a>
      <a className="landing-menu" href="/">{privacy ? (legalLanguage === 'de' ? 'Zur Startseite' : legalLanguage === 'ru' ? 'На главную' : 'Home') : 'На главную'} <ArrowRight size={14}/></a>
    </header>
    <section className="legal-hero">
      <div className="eyebrow"><Lock size={14}/> {privacy ? (legalLanguage === 'de' ? 'VIBE — OFFIZIELLE DOKUMENTE' : legalLanguage === 'ru' ? 'ОФИЦИАЛЬНЫЕ ДОКУМЕНТЫ VIBE' : 'VIBE OFFICIAL DOCUMENTS') : 'ОФИЦИАЛЬНЫЕ ДОКУМЕНТЫ VIBE'}</div>
      <h1>{title}</h1>
      <p>{privacy ? (legalLanguage === 'de' ? 'Aktuelle Fassung vom 23. Oktober 2026' : legalLanguage === 'ru' ? 'Действующая редакция от 23 октября 2026 года' : 'Current version dated 23 October 2026') : 'Действующая редакция от 23 октября 2026 года'}</p>
      {privacy ? <div className="legal-language-options" role="group" aria-label="Choose language"><span>{legalLanguage === 'de' ? 'Sprache' : legalLanguage === 'ru' ? 'Язык' : 'Language'}</span><button type="button" aria-pressed={legalLanguage === 'en'} className={legalLanguage === 'en' ? 'selected' : ''} onClick={() => changeLegalLanguage('en')}>English</button><button type="button" aria-pressed={legalLanguage === 'de'} className={legalLanguage === 'de' ? 'selected' : ''} onClick={() => changeLegalLanguage('de')}>Deutsch</button><button type="button" aria-pressed={legalLanguage === 'ru'} className={legalLanguage === 'ru' ? 'selected' : ''} onClick={() => changeLegalLanguage('ru')}>Русский</button></div> : null}
      <nav className="legal-switch" aria-label="Legal documents">
        <a className={!privacy ? 'selected' : ''} href="/rules">{privacy ? (legalLanguage === 'de' ? 'Nutzungsregeln' : legalLanguage === 'ru' ? 'Правила проекта' : 'Community Rules') : 'Правила проекта'}</a>
        <a className={privacy ? 'selected' : ''} href="/privacy">{privacy ? (legalLanguage === 'de' ? 'Datenschutz' : legalLanguage === 'ru' ? 'Конфиденциальность' : 'Privacy Policy') : 'Конфиденциальность'}</a>
      </nav>
    </section>
    {privacy ? (legalLanguage === 'ru' ? <article className="legal-document">
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
    </article> : legalLanguage === 'de' ? <article className="legal-document">
      <p className="legal-lead">Diese Datenschutzerklärung erläutert, welche Informationen bei der Nutzung von VIBE verarbeitet werden, zu welchen Zwecken dies geschieht und welche Schutzmaßnahmen vorgesehen sind.</p>
      <h2>1. Allgemeine Bestimmungen</h2>
      <p>VIBE ist ein über Telegram zugänglicher Dienst zum Kennenlernen und Kommunizieren. Mit der Nutzung bestätigt die Person, diese Datenschutzerklärung gelesen zu haben. Wer ihren Bedingungen nicht zustimmt, muss die Nutzung von VIBE beenden.</p>
      <p>Die Datenverarbeitung erfolgt nach den anwendbaren Datenschutzgesetzen, einschließlich der Datenschutz-Grundverordnung (DSGVO), soweit diese gilt.</p>
      <h2>2. Welche Informationen verarbeitet werden können</h2>
      <ul><li>Telegram-Kennungen, Name und Benutzername, soweit sie für Anmeldung und Betrieb erforderlich sind;</li><li>Profilangaben: Geburtsdatum oder Altersstatus, Stadt, Beschreibung, Interessen, Kennenlernziel und Foto;</li><li>Beiträge, Bilder und Videos, die in VIBE hochgeladen werden;</li><li>Angaben zu Likes, gegenseitigem Interesse, Nachrichten und Interaktionen;</li><li>Meldungen, Supportanfragen, Hinweise auf Regelverstöße und Moderationsmaßnahmen;</li><li>technische Daten und Ereignisprotokolle zur Sicherheit, Fehlerdiagnose und Verhinderung von Missbrauch.</li></ul>
      <p>VIBE fragt nicht nach dem Telegram-Passwort. Veröffentlichen Sie in Ihrem Profil oder in Nachrichten keine Informationen, die Sie anderen Nutzern nicht offenlegen möchten.</p>
      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <p>Daten werden verwendet, um VIBE bereitzustellen, Anmeldungen zu ermöglichen, Profile anzuzeigen, Chats zu betreiben, die Sicherheit zu gewährleisten, Meldungen zu bearbeiten, Betrug zu verhindern, gesetzliche Pflichten zu erfüllen und berechtigte Interessen des Dienstes und seiner Nutzer zu schützen.</p>
      <p>Je nach Situation beruht die Verarbeitung auf der Erfüllung der Nutzungsbedingungen, einer Einwilligung, einer gesetzlichen Pflicht oder berechtigten Interessen, sofern diese nicht gegenüber den Rechten und Freiheiten der betroffenen Person überwiegen.</p>
      <h2>4. Sichtbarkeit von Informationen</h2>
      <p>Angaben in öffentlichen Profilen und Beiträgen können für andere VIBE-Nutzer sichtbar sein. Nachrichten sind für die jeweiligen Chat-Teilnehmer und für autorisierte Personen zugänglich, soweit dies zur Prüfung von Meldungen und zur Sicherheit erforderlich ist. Veröffentlichen Sie keine Wohnadresse, Ausweisdokumente, Finanzdaten oder andere sensible Informationen.</p>
      <h2>4.1. Prüfung von Fotos, Videos und Nachrichten</h2>
      <p>Hochgeladene Fotos und Videos können durch automatisierte Systeme und autorisierte Moderatoren geprüft werden, um verbotene Inhalte, gefälschte Profile, Betrug, Bildrechtsverletzungen und Sicherheitsrisiken zu erkennen. Bei der Bearbeitung einer Meldung können Moderatoren die dazugehörigen Inhalte und Nachrichten einsehen, soweit dies zur Klärung erforderlich ist. Laden Sie keine Inhalte hoch, die Sie einer solchen Prüfung nicht zugänglich machen möchten.</p>
      <p>Zugriff auf Moderationsmaterial ist auf Personen zu beschränken, die ihn für Sicherheit und die Bearbeitung von Meldungen benötigen. Eine Prüfung kann zur Ablehnung oder Entfernung eines Beitrags, zur Einschränkung von Funktionen oder zur Sperrung eines Kontos führen. Automatisierte Systeme können Fehler machen und beweisen für sich allein nicht immer, dass ein Bild gefälscht ist; Entscheidungen werden, soweit möglich, im Kontext und unter Berücksichtigung von Rückmeldungen geprüft.</p>
      <p>Medien und meldungsbezogene Informationen werden so lange aufbewahrt, wie es für Prüfung, Betrieb und die Verhinderung wiederholter Verstöße erforderlich ist. Danach werden sie gelöscht oder anonymisiert, sofern keine gesetzliche Pflicht oder Streitbeilegung eine weitere Speicherung erfordert. Die konkrete Dauer hängt von der Datenart und den technischen Möglichkeiten ab. Nutzer können sich über den offiziellen VIBE-Telegram-Bot zu Prüfung, Löschung oder einer erneuten Überprüfung einer Moderationsentscheidung erkundigen.</p>
      <h2>5. Weitergabe an Dritte</h2>
      <p>Daten können im Rahmen des Plattformbetriebs von Telegram sowie von Infrastruktur- und technischen Dienstleistern verarbeitet werden, die Hosting, Speicherung und Betrieb von VIBE ermöglichen. Eine Weitergabe kann außerdem erfolgen, wenn eine rechtmäßige Anordnung einer zuständigen Behörde vorliegt oder sie zum Schutz von Rechten, der Nutzersicherheit oder zur Verhinderung rechtswidriger Handlungen erforderlich ist.</p>
      <p>Daten werden nicht an Dritte für deren eigene Marketingzwecke verkauft. Dienstleister erhalten nur die Informationen, die zur Erfüllung ihrer Aufgaben erforderlich sind.</p>
      <h2>6. Speicherdauer</h2>
      <p>Informationen werden so lange gespeichert, wie es für den Betrieb, die Sicherheit, die Klärung von Streitigkeiten und die Erfüllung gesetzlicher Pflichten erforderlich ist. Bestimmte Angaben können nach einer Kontolöschung für begrenzte Zeit erhalten bleiben, wenn dies zur Verhinderung wiederholter Verstöße, zur Untersuchung von Vorfällen oder zur Einhaltung des Gesetzes notwendig ist.</p>
      <h2>7. Datensicherheit</h2>
      <p>Es werden angemessene technische und organisatorische Schutzmaßnahmen eingesetzt, darunter Zugriffsbeschränkungen und Maßnahmen gegen unbefugte Nutzung. Keine Methode der Übertragung oder Speicherung kann absolute Sicherheit garantieren.</p>
      <h2>8. Rechte der Nutzer</h2>
      <p>Soweit das anwendbare Recht dies vorsieht, können Nutzer Auskunft über ihre personenbezogenen Daten, Berichtigung unrichtiger Angaben, Löschung, Einschränkung der Verarbeitung, Widerspruch oder Datenübertragbarkeit verlangen. Beruht die Verarbeitung auf einer Einwilligung, kann diese widerrufen werden; die Rechtmäßigkeit der Verarbeitung vor dem Widerruf bleibt davon unberührt.</p>
      <p>Für die Ausübung dieser Rechte oder Fragen zum Datenschutz wenden Sie sich über den offiziellen VIBE-Telegram-Bot an die Administration. Zum Schutz des Kontos kann ein Identitätsnachweis erforderlich sein.</p>
      <h2>9. Daten Minderjähriger</h2>
      <p>VIBE ist in einen Jugendbereich für Nutzer von 14 bis einschließlich 17 Jahren und einen Erwachsenenbereich ab 18 Jahren getrennt. Beide Bereiche sind voneinander isoliert: Profile, Likes und private Nachrichten sind nur innerhalb des jeweiligen Altersbereichs verfügbar. Personen unter 14 Jahren dürfen den Dienst nicht nutzen. Bei Hinweisen auf ein falsches Alter kann der Zugang eingeschränkt werden.</p>
      <h2>10. Cookies und externe Dienste</h2>
      <p>VIBE funktioniert über Telegram und kann technische Mechanismen verwenden, die für die Weboberfläche erforderlich sind. Telegram und andere externe Anbieter können eigene Technologien und Datenschutzerklärungen einsetzen. Bitte lesen Sie die Datenschutzinformationen der jeweiligen Plattformen.</p>
      <h2>11. Änderungen dieser Erklärung</h2>
      <p>Diese Datenschutzerklärung kann bei Änderungen der Funktionen, der Datenverarbeitung oder der geltenden Gesetze aktualisiert werden. Die aktuelle Fassung wird auf dieser Seite veröffentlicht. Wesentliche Änderungen können zusätzlich über verfügbare Kommunikationswege mitgeteilt werden.</p>
      <h2>12. Kontakt</h2>
      <p>Fragen und Anfragen zur Verarbeitung personenbezogener Daten können über den offiziellen VIBE-Telegram-Bot an die Administration gerichtet werden. Beschreiben Sie, welches Recht Sie ausüben möchten, und geben Sie die zur Prüfung erforderlichen Informationen an.</p>
      <p className="legal-note">Dieses Dokument beschreibt allgemeine Grundsätze der Datenverarbeitung. Vor einem kommerziellen Start sollten die rechtlichen Angaben zum Verantwortlichen, Kontaktinformationen und konkrete Speicherfristen entsprechend der tatsächlichen VIBE-Infrastruktur ergänzt werden.</p>
    </article> : <article className="legal-document">
      <p className="legal-lead">This Privacy Policy explains what information is processed when using VIBE, why it is used, and what measures are applied to protect it.</p>
      <h2>1. General provisions</h2>
      <p>VIBE is a service for meeting and communicating with others, available through Telegram. By using the service, users confirm that they have read this Policy. If a user disagrees with its terms, they must stop using VIBE.</p>
      <p>Data is processed in accordance with applicable data protection laws, including the General Data Protection Regulation (GDPR) where it applies.</p>
      <h2>2. Information that may be processed</h2>
      <ul><li>Telegram identifiers, name and username required for authentication and service operation;</li><li>profile details: date of birth or age-status confirmation, city, description, interests, dating goal and photo;</li><li>posts, images and videos uploaded to the service;</li><li>information about likes, matches, messages and interactions with other users;</li><li>reports, support requests, suspected violations and moderation actions;</li><li>technical data and event logs needed for security, troubleshooting and abuse prevention.</li></ul>
      <p>VIBE does not ask for a Telegram password. Do not include profile or chat information that you do not want other users to see.</p>
      <h2>3. Purposes and legal bases</h2>
      <p>Data is used to provide VIBE features, authenticate users, display profiles, operate chats, maintain safety, review reports, prevent fraud, meet legal obligations and protect the legitimate interests of the service and its users.</p>
      <p>Depending on the circumstances, processing may be based on performance of the terms of use, user consent, a legal obligation or legitimate interests, provided those interests do not override the user's rights and freedoms.</p>
      <h2>4. Visibility of information</h2>
      <p>Information added to a public profile or post may be visible to other VIBE users. Messages are accessible to the participants in the relevant chat and authorised personnel to the extent needed to review reports and maintain safety. Do not publish your home address, identity documents, financial details or other sensitive information.</p>
      <h2>4.1. Review of photos, videos and messages</h2>
      <p>Photos and videos uploaded to profiles and posts may be reviewed by automated tools and authorised moderators to identify prohibited content, fake profiles, fraud, image-rights violations and safety risks. When reviewing a report, moderators may view related content and messages to the extent necessary to assess the circumstances. Do not upload material that you are unwilling to make available for such review.</p>
      <p>Access to moderation materials should be limited to people who need it for safety and report handling. A review may result in a post being rejected or removed, features being restricted, or an account being suspended. Automated tools can make mistakes and do not always establish on their own that an image is fake; where possible, decisions are considered in context and in light of user feedback.</p>
      <p>Media and report-related information are retained for the period needed for review, service operation and prevention of repeated violations, then deleted or anonymised unless further storage is required by law or to resolve a dispute. The exact period depends on the type of data and technical capabilities. Users may contact VIBE through its official Telegram bot to ask about review, data deletion or reconsideration of a moderation decision.</p>
      <h2>5. Sharing data with third parties</h2>
      <p>Data may be processed by Telegram as part of its platform, and by infrastructure and technical service providers that host, store and operate VIBE. Data may also be disclosed in response to a lawful request from a competent authority or when necessary to protect rights, user safety or prevent unlawful conduct.</p>
      <p>Data is not sold to third parties for their own marketing purposes. Service providers receive only the information needed to perform their tasks.</p>
      <h2>6. Data retention</h2>
      <p>Information is kept for as long as necessary to operate the service, maintain safety, resolve disputes and meet legal obligations. Some information may be retained for a limited period after account deletion when needed to prevent repeated violations, investigate incidents or comply with law.</p>
      <h2>7. Information security</h2>
      <p>Reasonable technical and organisational safeguards are used, including access controls and measures to prevent unauthorised use. No method of transmission or storage can guarantee absolute security.</p>
      <h2>8. User rights</h2>
      <p>Where applicable law provides, users may request access to their personal data, correction of inaccurate information, deletion, restriction of processing, object to processing or request data portability. If processing is based on consent, it may be withdrawn; this does not affect the lawfulness of processing before withdrawal.</p>
      <p>To exercise these rights or ask privacy questions, contact VIBE administration through the official service Telegram bot. Identity confirmation may be required to protect the account.</p>
      <h2>9. Information about minors</h2>
      <p>VIBE separates users into a teen area for ages 14 through 17 and an adult area for users aged 18 and over. The two areas are isolated: profiles, likes and private messages are available only within the corresponding age group. People under 14 may not use the service. Access may be restricted if an age appears to be inaccurate.</p>
      <h2>10. Cookies and external services</h2>
      <p>VIBE operates through Telegram and may use technical mechanisms required for the web interface. Telegram and other external providers may use their own technologies and privacy policies. Please review the documents of the relevant platforms.</p>
      <h2>11. Changes to this Policy</h2>
      <p>This Policy may be updated when VIBE features, data-processing practices or applicable law change. The current version is published on this page. Significant changes may also be communicated through available channels.</p>
      <h2>12. Contact and requests</h2>
      <p>Questions and requests concerning personal-data processing may be sent to VIBE administration through the official Telegram bot. State which right you wish to exercise and provide the information needed to verify the request.</p>
      <p className="legal-note">This document describes general data-processing practices. Before a commercial launch, it should be supplemented with the controller's legal details, responsible contact information and specific retention periods that reflect VIBE's actual infrastructure.</p>
    </article>) : <article className="legal-document">
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
    <footer className="legal-footer"><span>vibe. © 2026</span><span><a href="/rules">{privacy && legalLanguage === 'en' ? 'Community Rules' : privacy && legalLanguage === 'de' ? 'Nutzungsregeln' : 'Правила'}</a><a href="/privacy">{privacy && legalLanguage === 'en' ? 'Privacy Policy' : privacy && legalLanguage === 'de' ? 'Datenschutz' : 'Конфиденциальность'}</a></span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(window.location.pathname === '/rules' || window.location.pathname === '/privacy' ? <LegalPage/> : <App/>);
