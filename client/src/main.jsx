import React,{useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import{Heart,Compass,UserRound,ShieldAlert,MapPin,Sparkles,ArrowRight,Check,Lock}from'lucide-react';
import'./style.css';

const demoPeople=[
{id:1,name:'Алина',age:21,city:'Берлин',bio:'Музыка, ночные прогулки и кофе после полуночи ✨',interests:['Музыка','Путешествия','Кино'],color:'rose'},
{id:2,name:'Марк',age:23,city:'Гамбург',bio:'Ищу людей для спонтанных приключений и хороших разговоров.',interests:['Игры','Музыка','Фото'],color:'blue'},
{id:3,name:'София',age:20,city:'Бремен',bio:'Креатив, уютные места и новые знакомства.',interests:['Искусство','Кофе','Книги'],color:'violet'}
];
function App(){
const [tab,setTab]=useState('discover');const [liked,setLiked]=useState([]);const [profile,setProfile]=useState({name:'Ты',bio:'',city:'',goal:'both',interests:[]});const [notice,setNotice]=useState('');
const isAdmin=location.pathname==='/admin';
if(isAdmin)return <AdminLink/>;
const people=useMemo(()=>demoPeople.filter(p=>!liked.includes(p.id)),[liked]);
return <main className="app-shell">
<header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><span className="online"><i/> рядом с тобой</span><button className="avatar" onClick={()=>setTab('profile')}>Я</button></header>
<section className="hero"><div className="eyebrow"><Sparkles size={14}/> ТВОЯ ВОЛНА</div><h1>Люди, с которыми<br/><span>совпадает вайб.</span></h1><p>Знакомься, находи общие интересы и создавай свои истории.</p></section>
<nav className="tabs"><button className={tab==='discover'?'active':''} onClick={()=>setTab('discover')}><Compass size={17}/> Знакомства</button><button className={tab==='likes'?'active':''} onClick={()=>setTab('likes')}><Heart size={17}/> Симпатии <b>{liked.length}</b></button><button className={tab==='profile'?'active':''} onClick={()=>setTab('profile')}><UserRound size={17}/> Профиль</button></nav>
{notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
{tab==='discover'&&<section className="people"><div className="section-heading"><div><h2>Твоя подборка</h2><p>Новые лица, близкие интересы</p></div><span className="count">{people.length} профиля</span></div>{people.length?people.map((p,i)=><article className="person-card" key={p.id}><div className={'person-art '+p.color}><span className="art-spark">✳</span><div className="person-initial">{p.name[0]}</div><span className="art-caption">VIBE / 0{i+1}</span></div><div className="person-info"><div className="person-title"><div><h3>{p.name}, {p.age}</h3><span className="location"><MapPin size={13}/>{p.city}</span></div><span className="match-score">♡ 92%</span></div><p>{p.bio}</p><div className="chips">{p.interests.map(x=><span key={x}>{x}</span>)}</div><div className="card-actions"><button className="skip" onClick={()=>setLiked([...liked,p.id])}>Пропустить</button><button className="like" onClick={()=>{setLiked([...liked,p.id]);setNotice('Симпатия отправлена 💜')}}><Heart size={17} fill="currentColor"/> Нравится</button></div></div></article>):<div className="empty"><Sparkles/><h3>Это пока всё</h3><p>Новые люди появятся здесь позже.</p></div>}</section>}
{tab==='likes'&&<section className="panel"><div className="panel-icon"><Heart/></div><h2>Твои симпатии</h2><p>Здесь появятся профили, которые ты отметишь. В демо-режиме список хранится только до обновления страницы.</p>{liked.length>0&&<div className="chips">{liked.map(id=><span key={id}>{demoPeople.find(p=>p.id===id)?.name||'Профиль'}</span>)}</div>}</section>}
{tab==='profile'&&<section className="panel profile-panel"><div className="panel-icon"><UserRound/></div><h2>Твой профиль</h2><p>Расскажи немного о себе, чтобы находить людей на одной волне.</p><label>Как тебя зовут<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})} maxLength={60}/></label><label>Город<input value={profile.city} onChange={e=>setProfile({...profile,city:e.target.value})} placeholder="Например, Берлин"/></label><label>О себе<textarea value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})} maxLength={500} placeholder="Что тебя вдохновляет?"/></label><label>Цель знакомства<select value={profile.goal} onChange={e=>setProfile({...profile,goal:e.target.value})}><option value="friendship">Дружба</option><option value="chat">Общение</option><option value="relationship">Отношения</option><option value="both">Посмотрим, как пойдёт</option></select></label><button className="save" onClick={()=>setNotice('Профиль сохранён в демо-режиме')}>Сохранить профиль <ArrowRight size={16}/></button></section>}
<footer><span>vibe. © 2026</span><span><Lock size={12}/> Твоя безопасность важна</span><a href="/admin">Админ-панель</a></footer>
</main>
}
function AdminLink(){return <main className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">v</span><span>vibe<span className="dot">.</span></span></div><a href="/">← В приложение</a></header><section className="panel"><div className="panel-icon"><ShieldAlert/></div><h1>VIBE Admin</h1><p>Панель модерации доступна только авторизованным администраторам Telegram. Для рабочей очереди настрой API и ADMIN_TELEGRAM_IDS.</p><a className="save" href="https://github.com/s00222404-prog/-">Открыть репозиторий <ArrowRight size={16}/></a></section></main>}
if(location.pathname==='/admin'){import('./admin.jsx')}else{createRoot(document.getElementById('root')).render(<App/>)}
