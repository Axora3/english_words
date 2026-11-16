import {u} from './labels.js';
// Post-render accessibility pass. Icons are rendered at the source (icons.js); nothing is swapped here.
export function polishUI(root,state,t){
 for(const el of root.querySelectorAll('.icon-btn,.audio-play')){if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',el.textContent.trim()||t('p.actions'));}
 for(const el of root.querySelectorAll('button[disabled]'))el.setAttribute('aria-disabled','true');
 // Horizontally scrollable strips keep their selected item visible on narrow screens.
 for(const strip of root.querySelectorAll('.tab-links,.chip-filter,.settings-nav,.segmented')){const active=strip.querySelector('.active,[aria-current="page"]');strip.classList.toggle('is-scrollable',strip.scrollWidth>strip.clientWidth+1);if(active&&strip.scrollWidth>strip.clientWidth)strip.scrollLeft=active.offsetLeft-(strip.clientWidth-active.offsetWidth)/2;}
 for(const el of root.querySelectorAll('input[type=search]')){el.setAttribute('autocomplete','off');el.setAttribute('spellcheck','false');}
 // Dialogs rendered as part of a view open modally and route Escape/backdrop to their cancel action.
 for(const dialog of document.querySelectorAll('dialog[data-autoshow]')){if(dialog.open)continue;dialog.showModal();dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.querySelector('[data-action$="cancel"]')?.click();});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.querySelector('[data-action$="cancel"]')?.click();});}
}
export function audioFeedback(playing,state){document.querySelectorAll('.reading-actions').forEach(el=>el.classList.toggle('is-playing',playing));const label=document.querySelector('#audio-status');if(label)label.textContent=u(state,playing?'playing':'idleAudio');}
