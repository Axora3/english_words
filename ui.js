// English Words design-system components. Each helper returns an HTML string so it fits the
// app's existing string-rendering architecture. Interactive behaviour stays in the action handlers.
import {icon} from './icons.js';

export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=(name,value)=>value===undefined||value===null||value===false?'':value===true?` ${name}`:` ${name}="${esc(value)}"`;
export const pct=(value,total)=>total?Math.max(0,Math.min(100,Math.round(value/total*100))):0;

/** Button / link styled as a button. kind: primary | secondary | ghost | danger | chip */
export function button(label,{action,href,kind='primary',size='',ic,iconEnd,full,disabled,type,attrs='',title}={}){
 const cls=`btn ${kind}${size?' '+size:''}${full?' full':''}`;
 const inner=`${ic?icon(ic):''}${label?`<span>${label}</span>`:''}${iconEnd?icon(iconEnd):''}`;
 if(href)return `<a class="${cls}" href="${href}"${attr('title',title)} ${attrs}>${inner}</a>`;
 return `<button class="${cls}"${type?` type="${type}"`:''}${action?` data-action="${action}"`:''}${attr('disabled',disabled)}${attr('title',title)} ${attrs}>${inner}</button>`;
}
/** Icon-only control. Always has an accessible name and a tooltip. */
export function iconButton(ic,label,{action,href,kind='',pressed,attrs='',filled=false}={}){
 const a=`aria-label="${esc(label)}" data-tooltip="${esc(label)}"${pressed===undefined?'':` aria-pressed="${pressed}"`}`;
 const inner=icon(ic,{filled});
 if(href)return `<a class="icon-btn ${kind}" href="${href}" ${a} ${attrs}>${inner}</a>`;
 return `<button class="icon-btn ${kind}" type="button"${action?` data-action="${action}"`:''} ${a} ${attrs}>${inner}</button>`;
}
export function pageHeader({eyebrow='',title,sub='',actions='',back=null}){
 return `<header class="page-header">${back?`<a class="back-link" href="${back.href}">${icon('arrow-left')}<span>${back.label}</span></a>`:''}<div class="page-header-row"><div class="page-header-copy">${eyebrow?`<p class="eyebrow">${eyebrow}</p>`:''}<h1>${title}</h1>${sub?`<p class="page-sub">${sub}</p>`:''}</div>${actions?`<div class="page-actions">${actions}</div>`:''}</div></header>`;
}
export function sectionHeader(title,{sub='',action='',id='',level=2}={}){
 return `<div class="section-header"><div><h${level}${id?` id="${id}"`:''}>${title}</h${level}>${sub?`<p>${sub}</p>`:''}</div>${action?`<div class="section-action">${action}</div>`:''}</div>`;
}
export function stat(value,label,{note='',tone='',ic='',href=''}={}){
 const body=`<span class="stat-label">${ic?icon(ic):''}${label}</span><strong class="stat-value num">${value}</strong>${note?`<span class="stat-note">${note}</span>`:''}`;
 return href?`<a class="stat ${tone}" href="${href}">${body}</a>`:`<div class="stat ${tone}">${body}</div>`;
}
export function progressBar(percent,{label='',tone='',size='',valueText=''}={}){
 const p=Math.max(0,Math.min(100,Math.round(percent||0)));
 return `<div class="progress ${tone} ${size}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"${label?` aria-label="${esc(label)}"`:''}${valueText?` aria-valuetext="${esc(valueText)}"`:''}><i style="--p:${p}%"></i></div>`;
}
export function progressRing(percent,{size=96,stroke=8,label='',center='',tone=''}={}){
 const p=Math.max(0,Math.min(100,percent||0)),r=(size-stroke)/2,c=2*Math.PI*r;
 return `<div class="ring ${tone}" style="--size:${size}px;--c:${c.toFixed(2)}px" role="img" aria-label="${esc(label||p+'%')}"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="ring-track" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"/>${p>0?`<circle class="ring-value" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c*(1-p/100)).toFixed(2)}"/>`:''}</svg><div class="ring-center">${center}</div></div>`;
}
export function badge(text,tone=''){return `<span class="badge ${tone}">${text}</span>`;}
export function cefr(level){const l=String(level||'').toUpperCase();return `<span class="cefr cefr-${l.toLowerCase()}" title="CEFR ${esc(l)}">${esc(l)}</span>`;}
export function emptyState({ic='book-2',title,body='',action=''}){
 return `<div class="empty-state"><span class="empty-icon">${icon(ic)}</span><h2>${title}</h2>${body?`<p>${body}</p>`:''}${action?`<div class="empty-action">${action}</div>`:''}</div>`;
}
export function notice(body,{tone='',ic='info-circle',role=''}={}){return `<div class="notice ${tone}"${role?` role="${role}"`:''}>${icon(ic)}<div>${body}</div></div>`;}
/** Segmented control made of buttons; items: [{label,action,active,count}] */
export function segmented(items,{label='',className=''}={}){
 return `<div class="segmented ${className}" role="group"${label?` aria-label="${esc(label)}"`:''}>${items.map(i=>`<button type="button" class="${i.active?'active':''}" data-action="${i.action}" aria-pressed="${Boolean(i.active)}">${i.ic?icon(i.ic):''}<span>${i.label}</span>${i.count!==undefined?`<b class="num">${i.count}</b>`:''}</button>`).join('')}</div>`;
}
/** Tabs as navigation links (route tabs). items: [{href,label,active,ic}] */
export function tabLinks(items,{label=''}={}){
 return `<nav class="tab-links" aria-label="${esc(label)}">${items.map(i=>`<a href="${i.href}" class="${i.active?'active':''}"${i.active?' aria-current="page"':''}>${i.ic?icon(i.ic):''}<span>${i.label}</span></a>`).join('')}</nav>`;
}
export function iconTile(ic,hue='accent',{size=''}={}){return `<span class="icon-tile hue-${hue} ${size}">${icon(ic)}</span>`;}
export function kbd(key){return `<kbd>${esc(key)}</kbd>`;}
export function skeleton(lines=3){return `<div class="skeleton-group" aria-hidden="true">${Array.from({length:lines},(_,i)=>`<span class="skeleton" style="width:${[92,76,58,84][i%4]}%"></span>`).join('')}</div>`;}
/** Settings row: label/description on the left, control on the right. */
export function settingRow(title,control,{help='',tag='label',ic=''}={}){
 return `<${tag} class="setting-row">${ic?`<span class="setting-icon">${icon(ic)}</span>`:''}<span class="setting-copy"><strong>${title}</strong>${help?`<small>${help}</small>`:''}</span><span class="setting-control">${control}</span></${tag}>`;
}
/** Navigation row (link) used in settings and the More directory. */
export function linkRow(href,title,{help='',ic='',meta='',hue=''}={}){
 return `<a class="link-row" href="${href}">${ic?(hue?iconTile(ic,hue,{size:'sm'}):`<span class="setting-icon">${icon(ic)}</span>`):''}<span class="setting-copy"><strong>${title}</strong>${help?`<small>${help}</small>`:''}</span>${meta?`<span class="link-meta">${meta}</span>`:''}${icon('chevron-right')}</a>`;
}
export function switchControl(name,checked,{label=''}={}){
 return `<span class="switch"><input type="checkbox" role="switch" name="${name}"${checked?' checked':''}${label?` aria-label="${esc(label)}"`:''}><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span></span>`;
}
export function selectControl(name,options,value,{id='',label=''}={}){
 return `<span class="select"><select${name?` name="${name}"`:''}${id?` id="${id}"`:''}${label?` aria-label="${esc(label)}"`:''}>${options.map(([v,l])=>`<option value="${esc(v)}"${String(v)===String(value)?' selected':''}>${l}</option>`).join('')}</select>${icon('selector')}</span>`;
}
export function searchInput({id,value='',placeholder='',label='',shortcut=''}){
 return `<label class="search-input">${icon('search')}<input id="${id}" type="search" value="${esc(value)}" placeholder="${esc(placeholder)}" aria-label="${esc(label||placeholder)}" autocomplete="off" spellcheck="false">${shortcut?kbd(shortcut):''}</label>`;
}
/** Quiz option (radio). state: '' | 'correct' | 'wrong' | 'missed' */
export function quizOption({name,value,label,key,state='',disabled=false,checked=false,lang=''}){
 const mark=state==='correct'||state==='missed'?icon('circle-check'):state==='wrong'?icon('circle-x'):'';
 return `<label class="quiz-option${state?' is-'+state:''}"><input type="radio" name="${name}" value="${esc(value)}" required${disabled?' disabled':''}${checked?' checked':''}><span class="quiz-key">${key}</span><span class="quiz-label"${lang?` lang="${lang}"`:''}>${label}</span><span class="quiz-mark">${mark}</span></label>`;
}
/** Feedback banner after an answer. */
export function feedback(ok,title,body=''){
 return `<div class="feedback ${ok?'is-correct':'is-wrong'}" role="status">${icon(ok?'circle-check':'alert-circle')}<div><strong>${title}</strong>${body?`<p>${body}</p>`:''}</div></div>`;
}
/** Simple labelled bar chart. series: [{label, values:[...], tone}] ; columns: [{label, title}] */
export function barChart(columns,series,{max,label='',current=-1,height=140}={}){
 const top=Math.max(1,max??Math.max(...series.flatMap(s=>s.values)));
 const nice=top<=5?5:top<=10?10:Math.ceil(top/5)*5;
 return `<figure class="bar-chart" style="--h:${height}px" role="img" aria-label="${esc(label)}"><div class="bar-axis" aria-hidden="true"><span class="num">${nice}</span><span class="num">${Math.round(nice/2)}</span><span class="num">0</span></div><div class="bar-plot" aria-hidden="true">${columns.map((c,i)=>`<div class="bar-col${i===current?' current':''}" title="${esc(c.title||'')}"><div class="bar-stack">${series.map(s=>`<i class="bar ${s.tone||''}" style="--v:${(s.values[i]/nice*100).toFixed(1)}%"></i>`).join('')}</div><span class="bar-label">${c.label}</span></div>`).join('')}</div></figure>`;
}
export function legend(items){return `<div class="legend">${items.map(([tone,label])=>`<span><i class="${tone}"></i>${label}</span>`).join('')}</div>`;}
