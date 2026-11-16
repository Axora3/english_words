// Application shell: desktop sidebar, top bar and mobile bottom navigation.
import {icon} from './icons.js';
import {u} from './labels.js';
import {dueWords,streak} from './core.js';
import {iconButton,esc} from './ui.js';

let markId=0;
/** English Words logo: the letter E beside an open book that doubles as a speech bubble. Unique gradient ids per instance. */
export function brandMark(){const n=++markId;return `<svg class="brand-mark" viewBox="0 0 72 64" aria-hidden="true"><defs><linearGradient id="ew-e-${n}" x1="0" y1="8" x2="0" y2="54" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#36A6F8"/><stop offset="1" stop-color="#2A80EC"/></linearGradient><linearGradient id="ew-b-${n}" x1="67" y1="4" x2="34" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8AEDF2"/><stop offset=".55" stop-color="#45B4F5"/><stop offset="1" stop-color="#2D86E8"/></linearGradient></defs><g fill="url(#ew-e-${n})"><rect x="4" y="8" width="11" height="46" rx="4.5"/><rect x="4" y="8" width="27" height="11" rx="4.5"/><rect x="4" y="25.5" width="23" height="11" rx="4.5"/><rect x="4" y="43" width="27" height="11" rx="4.5"/></g><path fill="url(#ew-b-${n})" d="M37 9C44 9 52 6 62 4Q67 3 67 8L67 40Q67 45 62 46C54 47.5 46 50 41 54L34 61Q32 62.5 32.8 59.8L36.5 48Q37 46 37 44Z"/><path fill="#fff" opacity=".28" d="M37 9C41 10 44 12 46 14L46 47C44 47.6 42.4 48.6 41 50L37 52Z"/></svg>`;}

const primary=[['dashboard','home','home'],['library','book-2','vocabulary'],['review','refresh','review'],['practice','target-arrow','practice'],['statistics','chart-bar','progress']];
const groups={library:['library','dictionary','details','learn','favorites','history','collections','import'],practice:['practice','test','results','writing','phrases','context','families'],statistics:['statistics','analytics','calendar','goals','weak','achievements','challenges','mistakes']};
export function activeGroup(route){for(const [name,list] of Object.entries(groups))if(list.includes(route))return name;return route;}

/** Human title for a route, used by the top bar. */
export function routeTitle(route,state,t){
 const own={dashboard:u(state,'home'),library:u(state,'vocabulary'),statistics:u(state,'progress'),tools:u(state,'more'),practice:u(state,'practice'),review:u(state,'review'),account:u(state,'account')};
 if(own[route])return own[route];
 const core={learn:'learn',test:'test',results:'test',favorites:'favorites',history:'history',settings:'settings',notifications:'notifications',grammar:'grammar',widget:'widget',details:'details'};
 return core[route]?t(core[route]):t('p.'+route);
}

export function sidebar(state,route,{t,day}){
 const active=activeGroup(route),due=dueWords(state).length;
 const link=(name,ic,label,{current=false,count=0}={})=>`<a class="nav-link${current?' active':''}" href="#${name}"${current?' aria-current="page"':''} data-tooltip="${esc(label)}">${icon(ic)}<span class="nav-label">${label}</span>${count?`<b class="nav-count num" aria-label="${count} ${esc(u(state,'dueShort'))}">${count}</b>`:''}</a>`;
 const done=day.ids.filter(id=>state.learned[id]).length,total=day.ids.length;
 return `<aside class="sidebar" id="sidebar-navigation" aria-label="${esc(t('mainMenu'))}">
  <div class="sidebar-head"><a class="brand" href="#dashboard" aria-label="English Words — ${esc(u(state,'home'))}">${brandMark()}<span class="brand-name">English Words</span></a>
   <button class="icon-btn sidebar-collapse" type="button" data-action="collapse-sidebar" aria-expanded="${!document.body.classList.contains('sidebar-collapsed')}" aria-label="${esc(t('p.collapse'))}" data-tooltip="${esc(t('p.collapse'))}">${icon('layout-sidebar-left-collapse',{className:'when-open'})}${icon('layout-sidebar-left-expand',{className:'when-collapsed'})}</button></div>
  <div class="sidebar-scroll">
   <nav class="nav-group" aria-label="${esc(u(state,'workspace'))}"><p class="nav-caption">${u(state,'workspace')}</p>${primary.map(([name,ic,label])=>link(name,ic,u(state,label),{current:active===name,count:name==='review'?due:0})).join('')}</nav>
   <nav class="nav-group" aria-label="${esc(u(state,'library'))}"><p class="nav-caption">${u(state,'library')}</p>${[['grammar','school',t('grammar')],['collections','folders',t('p.collections')],['favorites','heart',t('favorites')],['history','clock',t('history')]].map(([name,ic,label])=>link(name,ic,label,{current:route===name})).join('')}</nav>
  </div>
  <div class="sidebar-foot">
   <a class="sidebar-today" href="#learn" data-tooltip="${esc(u(state,'dayTrack'))}"><span class="mini-ring" style="--p:${total?done/total*100:0}%"><span class="num">${done}</span></span><span class="nav-label"><strong>${u(state,'dayTrack')}</strong><small class="num">${done} / ${total}</small></span></a>
   ${link('tools','dots',u(state,'more'),{current:route==='tools'})}
   ${link('settings','settings',t('settings'),{current:['settings','notifications','widget','account'].includes(route)})}
  </div>
 </aside>`;
}

export function topbar(state,route,{t,title,dateText,sync=null}){
 const s=streak(state),dark=state.settings.theme!=='light';
 return `<header class="topbar">
  <button class="icon-btn mobile-menu" type="button" data-action="menu" aria-expanded="false" aria-controls="sidebar-navigation" aria-label="${esc(u(state,'menu'))}">${icon('menu-2')}</button>
  <a class="topbar-brand" href="#dashboard" aria-label="English Words">${brandMark()}</a>
  <div class="topbar-title"><strong>${title}</strong><span class="topbar-date">${dateText}</span></div>
  <div class="topbar-actions">
   <a class="topbar-search" href="#library" data-action="focus-search">${icon('search')}<span>${u(state,'searchWords')}</span><kbd>/</kbd></a>
   ${iconButton('search',u(state,'searchWords'),{href:'#library',kind:'topbar-search-icon'})}
   ${s?`<a class="streak-chip" href="#calendar" aria-label="${s} — ${esc(t('streak'))}" data-tooltip="${esc(t('streak'))}">${icon('flame')}<span class="num">${s}</span></a>`:''}
   ${sync||''}
   ${iconButton(dark?'sun':'moon',u(state,dark?'toLight':'toDark'),{action:'theme-toggle'})}
   <a class="icon-btn" href="#notifications" aria-label="${esc(t('notifications'))}" data-tooltip="${esc(t('notifications'))}">${icon('bell')}${state.settings.notifications?'<i class="dot" aria-hidden="true"></i>':''}</a>
  </div>
 </header>`;
}

export function bottomNav(state,route,{t}){
 const active=activeGroup(route),due=dueWords(state).length;
 return `<nav class="bottom-nav" aria-label="${esc(t('mainMenu'))}">${primary.map(([name,ic,label])=>`<a href="#${name}" class="${active===name?'active':''}"${active===name?' aria-current="page"':''}><span class="bottom-icon">${icon(ic)}${name==='review'&&due?`<b class="num">${due>99?'99+':due}</b>`:''}</span><span class="bottom-label">${u(state,label)}</span></a>`).join('')}</nav>`;
}
