import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

function VibeDatePicker({value,onChange,language='en',maxDate=''}) {
 const [open,setOpen]=useState(false);
 const [view,setView]=useState('days');
 const [month,setMonth]=useState(()=>{const d=value?new Date(value+'T12:00:00'):new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
 const names=language==='ru'?['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']:language==='de'?['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']:['January','February','March','April','May','June','July','August','September','October','November','December'];
 const weekdays=language==='ru'?['Пн','Вт','Ср','Чт','Пт','Сб','Вс']:language==='de'?['Mo','Di','Mi','Do','Fr','Sa','So']:['Mo','Tu','We','Th','Fr','Sa','Su'];
 const chosen=value?new Date(value+'T12:00:00'):null;
 const first=new Date(month.getFullYear(),month.getMonth(),1);
 const offset=(first.getDay()+6)%7;
 const days=Array.from({length:42},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i-offset+1));
 const today=new Date();today.setHours(0,0,0,0);
 const max=maxDate?new Date(maxDate+'T00:00:00'):today;
 const maxYear=max.getFullYear();
 const minYear=1900;
 const years=Array.from({length:Math.max(1,maxYear-minYear+1)},(_,i)=>maxYear-i);
 const fmt=(d)=>String(d.getFullYear())+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const locale=language==='ru'?'ru-RU':language==='de'?'de-DE':'en-GB';
 const display=chosen&&!Number.isNaN(chosen.getTime())?chosen.toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'}):(language==='ru'?'Выбрать дату':language==='de'?'Datum auswählen':'Choose date');
 const changeMonth=(year,monthIndex)=>{setMonth(new Date(year,monthIndex,1));setView('days')};
 useEffect(()=>{if(!open)return;const onKeyDown=e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);setView('days')}};window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown)},[open]);
 return <div className="vibe-date-picker">
  <button type="button" className={'vibe-date-trigger'+(open?' is-open':'')} onClick={()=>{if(!open){const d=value?new Date(value+'T12:00:00'):new Date();setMonth(new Date(d.getFullYear(),d.getMonth(),1));setView('days')}setOpen(v=>!v)}} aria-haspopup="dialog" aria-expanded={open}><span className="vibe-date-icon"><span/></span><span className={value?'':'vibe-date-placeholder'}>{display}</span><span className="vibe-date-trigger-caret">⌄</span></button>
  {open&&<div className="vibe-calendar-popover" role="dialog" aria-label={language==='ru'?'Выбор даты':language==='de'?'Datum auswählen':'Choose a date'}>
   <div className="vibe-calendar-top"><div><small>{language==='ru'?'ВЫБОР ДАТЫ':language==='de'?'DATUM WÄHLEN':'SELECT DATE'}</small><b>{chosen&&!Number.isNaN(chosen.getTime())?chosen.toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric'}):(language==='ru'?'Дата рождения':language==='de'?'Geburtsdatum':'Date of birth')}</b></div><span className="vibe-calendar-orb">✦</span></div>
   <div className="vibe-calendar-month"><button type="button" aria-label={language==='ru'?'Предыдущий месяц':language==='de'?'Vorheriger Monat':'Previous month'} disabled={month.getFullYear()===minYear&&month.getMonth()===0} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ArrowLeft size={16}/></button><button type="button" className="vibe-calendar-month-title" onClick={()=>setView(view==='years'?'months':'years')} aria-label={language==='ru'?'Выбрать год и месяц':'Choose year and month'}>{names[month.getMonth()]} {month.getFullYear()} <span>▾</span></button><button type="button" aria-label={language==='ru'?'Следующий месяц':language==='de'?'Nächster Monat':'Next month'} disabled={month.getFullYear()>maxYear||(month.getFullYear()===maxYear&&month.getMonth()>=max.getMonth())} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ArrowRight size={16}/></button></div>
   {view==='years'&&<div className="vibe-calendar-years">{years.map(year=><button type="button" key={year} className={year===month.getFullYear()?'is-selected':''} onClick={()=>{setMonth(new Date(year,month.getMonth(),1));setView('months')}}>{year}</button>)}</div>}
   {view==='months'&&<div className="vibe-calendar-months">{names.map((name,index)=>{const disabled=month.getFullYear()===maxYear&&index>max.getMonth();return <button type="button" key={name} disabled={disabled} className={index===month.getMonth()?'is-selected':''} onClick={()=>changeMonth(month.getFullYear(),index)}>{name}</button>})}</div>}
   {view==='days'&&<><div className="vibe-calendar-grid vibe-calendar-weekdays">{weekdays.map(d=><span key={d}>{d}</span>)}</div><div className="vibe-calendar-grid">{days.map((d,i)=>{const key=fmt(d),same=d.getMonth()===month.getMonth(),active=value===key,disabled=d>max||d.getFullYear()<minYear;return <button type="button" key={i} disabled={disabled} className={['vibe-calendar-day',same?'':'is-outside',active?'is-selected':'',fmt(d)===fmt(today)?'is-today':''].filter(Boolean).join(' ')} onClick={()=>{onChange(key);setOpen(false);setView('days')}}>{d.getDate()}</button>})}</div></>}
   <div className="vibe-calendar-bottom"><span>{language==='ru'?'Выбери день рождения':language==='de'?'Wähle deinen Geburtstag':'Pick your birthday'}</span><button type="button" onClick={()=>{onChange('');setOpen(false);setView('days')}}>{language==='ru'?'Очистить':language==='de'?'Löschen':'Clear'}</button></div>
  </div>}
 </div>;
}

export default VibeDatePicker;
