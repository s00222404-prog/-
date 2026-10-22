import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Compass, UserRound, ShieldAlert, MapPin, Sparkles, ArrowRight, Lock, RefreshCw } from 'lucide-react';
import './style.css';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const webApp = window.Telegram?.WebApp;
const initData = webApp?.initData || '';

function App() {
  const [tab, setTab] = useState('discover');
  const [user, setUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [profile, setProfile] = useState({ birthDate: '', gender: '', bio: '', city: '', photoUrl: '', goal: 'both', interests: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ageStatus, setAgeStatus] = useState(null);

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
    if (!response.ok) throw new Error(data.error || 'Ошибка сервера (' + response.status + ')');
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
    } catch (e) {
      setError(e.message || 'Не удалось подключиться к VIBE API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadApp(); }, []);

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
      setNotice(result.route === 'age_gate'
        ? 'Профиль сохранён. Укажи дату рождения, чтобы продолжить.'
        : result.route === 'youth'
          ? 'Профиль сохранён. VIBE для знакомств доступен только совершеннолетним.'
          : 'Профиль сохранён. Для доступа к знакомствам нужно пройти проверку совершеннолетия.');
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

  async function skip(person) {
    // Hiding a card is only a local action; it does not create a like.
    setPeople(current => current.filter(p => p.id !== person.id));
  }

  if (location.pathname === '/admin') return <AdminLink />;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><span className="online"><i/> {user ? 'Telegram подключён' : 'знакомства'}</span><button className="avatar" onClick={() => setTab('profile')}>{(user?.first_name || 'Я').slice(0, 1)}</button></header>
    <section className="hero"><div className="eyebrow"><Sparkles size={14}/> ТВОЯ ВОЛНА</div><h1>Люди, с которыми<br/><span>совпадает вайб.</span></h1><p>Настоящие анкеты пользователей VIBE — без выдуманных профилей.</p></section>
    <nav className="tabs"><button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass size={17}/> Знакомства</button><button className={tab === 'likes' ? 'active' : ''} onClick={() => setTab('likes')}><Heart size={17}/> Симпатии</button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><UserRound size={17}/> Профиль</button></nav>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    {error && <div className="notice" role="alert"><ShieldAlert size={16}/><span>{error}</span><button onClick={loadApp} title="Повторить"><RefreshCw size={15}/></button></div>}
    {loading && <div className="panel"><p>Подключаем VIBE…</p></div>}
    {!loading && tab === 'discover' && <section className="people">
      <div className="section-heading"><div><h2>Твоя подборка</h2><p>Показываем только анкеты, сохранённые в базе VIBE</p></div><span className="count">{people.length} анкет</span></div>
      {!error && ageStatus && !ageStatus.adultAccess && <div className="panel"><div className="panel-icon"><Lock/></div><h2>Сначала подтвердим возраст</h2><p>Для безопасности анкеты знакомств доступны только совершеннолетним пользователям после проверки возраста. Укажи дату рождения в профиле. Сейчас интеграция провайдера проверки ещё не подключена.</p><button className="save" onClick={() => setTab('profile')}>Открыть профиль <ArrowRight size={16}/></button></div>}
      {ageStatus?.adultAccess && people.length === 0 && <div className="empty"><Sparkles/><h3>Пока нет доступных анкет</h3><p>Здесь появятся реальные пользователи, когда они зарегистрируются и пройдут необходимые проверки.</p></div>}
      {ageStatus?.adultAccess && people.map(p => <article className="person-card" key={p.id}>
        <div className="person-art violet">{p.photo_url ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div className="person-initial">{(p.name || '?').slice(0,1)}</div>}<span className="art-caption">VIBE / MEMBER</span></div>
        <div className="person-info"><div className="person-title"><div><h3>{p.name || 'Пользователь'}</h3><span className="location"><MapPin size={13}/>{p.city || 'Город не указан'}</span></div></div><p>{p.bio || 'Пока без описания.'}</p><div className="chips">{(p.interests || []).map(x => <span key={x}>{x}</span>)}</div><div className="card-actions"><button className="skip" onClick={() => skip(p)}>Пропустить</button><button className="like" onClick={() => like(p)}><Heart size={17} fill="currentColor"/> Нравится</button></div></div>
      </article>)}
    </section>}
    {!loading && tab === 'likes' && <section className="panel"><div className="panel-icon"><Heart/></div><h2>Симпатии</h2><p>Лайки отправляются в базу VIBE. Раздел взаимных симпатий и чатов ещё нужно реализовать.</p></section>}
    {!loading && tab === 'profile' && <section className="panel profile-panel"><div className="panel-icon"><UserRound/></div><h2>Твой профиль</h2><p>Профиль сохраняется в базе данных и привязывается к твоему Telegram.</p>
      <form onSubmit={saveProfile}>
        <label>Имя в Telegram<input value={user?.first_name || ''} readOnly/></label>
        <label>Дата рождения<input type="date" value={profile.birthDate} max={new Date().toISOString().slice(0,10)} onChange={e => setProfile({...profile,birthDate:e.target.value})} required/></label>
        <label>Пол (необязательно)<select value={profile.gender} onChange={e => setProfile({...profile,gender:e.target.value})}><option value="">Не указывать</option><option value="woman">Женщина</option><option value="man">Мужчина</option><option value="nonbinary">Небинарный человек</option><option value="prefer_not_to_say">Предпочитаю не отвечать</option></select></label>
        <label>Город<input value={profile.city} onChange={e => setProfile({...profile,city:e.target.value})} maxLength={100} placeholder="Например, Берлин"/></label>
        <label>О себе<textarea value={profile.bio} onChange={e => setProfile({...profile,bio:e.target.value})} maxLength={500} placeholder="Расскажи о себе"/></label>
        <label>Фото — ссылка на изображение (пока без загрузки файлов)<input type="url" value={profile.photoUrl} onChange={e => setProfile({...profile,photoUrl:e.target.value})} placeholder="https://..."/></label>
        <label>Цель знакомства<select value={profile.goal} onChange={e => setProfile({...profile,goal:e.target.value})}><option value="friendship">Дружба</option><option value="chat">Общение</option><option value="relationship">Отношения</option><option value="both">Посмотрим, как пойдёт</option></select></label>
        <label>Интересы через запятую<input value={profile.interests} onChange={e => setProfile({...profile,interests:e.target.value})} placeholder="Музыка, кино, прогулки"/></label>
        {ageStatus && <p>Статус проверки возраста: <b>{({unverified:'не подтверждён',pending:'на проверке',verified:'подтверждён',rejected:'отклонён',manual_review:'нужна дополнительная проверка'})[ageStatus.status] || 'неизвестен'}</b></p>}
        <button className="save" type="submit" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить профиль'} <ArrowRight size={16}/></button>
      </form>
    </section>}
    <footer><span>vibe. © 2026</span><span><Lock size={12}/> Безопасность важна</span><a href="/admin">Админ-панель</a></footer>
  </main>;
}

function AdminLink() {
  return <main className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><a href="/">← В приложение</a></header><section className="panel"><div className="panel-icon"><ShieldAlert/></div><h1>VIBE Admin</h1><p>Панель модерации доступна только авторизованным администраторам Telegram. Открой её из Mini App.</p><a className="save" href="https://github.com/s00222404-prog/-">Открыть репозиторий <ArrowRight size={16}/></a></section></main>;
}

createRoot(document.getElementById('root')).render(<App/>);
