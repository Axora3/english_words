import {u} from './premium.js';
// Post-render accessibility pass. Icons are rendered at the source (icons.js); nothing is swapped here.
export function polishUI(root,state,t){
 for(const el of root.querySelectorAll('.icon-btn,.audio-play')){if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',el.textContent.trim()||t('p.actions'));}
 for(const el of root.querySelectorAll('button[disabled]'))el.setAttribute('aria-disabled','true');
 for(const el of root.querySelectorAll('input[type=search]')){el.setAttribute('autocomplete','off');el.setAttribute('spellcheck','false');}
 // Dialogs rendered as part of a view open modally and route Escape/backdrop to their cancel action.
 for(const dialog of document.querySelectorAll('dialog[data-autoshow]')){if(dialog.open)continue;dialog.showModal();dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.querySelector('[data-action$="cancel"]')?.click();});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.querySelector('[data-action$="cancel"]')?.click();});}
}
export function audioFeedback(playing,state){document.querySelectorAll('.reading-actions').forEach(el=>el.classList.toggle('is-playing',playing));const label=document.querySelector('#audio-status');if(label)label.textContent=u(state,playing?'playing':'idleAudio');}
