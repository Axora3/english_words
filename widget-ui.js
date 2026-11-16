import {words} from './words.js';
import {createWidgetModel} from './widget-model.js';
import {icon} from './icons.js';
import {u} from './labels.js';
import {button,pageHeader,sectionHeader,segmented,badge,notice} from './ui.js';

export function widgetPage(state, {t,esc,timeLabel}, size='medium') {
  // Preview uses a copy so opening setup never creates/changes a learning schedule.
  const current=createWidgetModel().view(JSON.parse(JSON.stringify(state)),words), L=k=>u(state,k);
  const native=`<div class="iphone-widget ${size}" role="img" aria-label="${esc(t('widgetPreview'))}">
    <div class="widget-native-header"><span>ENGLISH WORDS</span><small class="num">${current.done}/${current.total}</small></div>
    ${current.word?`<span class="widget-native-label">${esc(current.word.level)} · ${t('newWords')}</span><strong lang="en" class="widget-native-word">${esc(current.word.word)}</strong><span lang="en" class="widget-native-ipa">${esc(current.word.ipa)}</span><span lang="mn" class="widget-native-meaning">${esc(current.word.translation)}</span><div class="widget-native-actions" aria-hidden="true"><span>${icon('volume')}${t('pronounce')}</span>${size==='medium'?`<span>${icon('check')}${t('learned')}</span>`:''}</div>`
    :`<span class="widget-native-label">${t(current.status==='waiting'?'nextWord':'done')}</span><strong class="widget-native-word num">${current.nextAt?timeLabel(current.nextAt):icon('circle-check')}</strong><span class="widget-native-ipa">${t(current.status==='waiting'?'waitingSub':'allDoneSub')}</span>`}
  </div>`;
  return `<a class="back-link" href="#settings">${icon('arrow-left')}<span>${t('settings')}</span></a>${pageHeader({eyebrow:'Scriptable · iPhone',title:t('widgetTitle'),sub:t('widgetSub')})}
    <div class="widget-layout"><section class="widget-stage">
      ${segmented(['small','medium'].map(value=>({label:t('widgetSize'+value),action:'widget-size:'+value,active:size===value})),{label:t('widgetSize')})}
      <div class="widget-phone">${native}</div>
      <p class="key-hint center">${t('widgetPreviewNote')}</p>
      ${current.word?button(t('pronounce'),{action:'speak:'+current.word.id,kind:'secondary',ic:'volume'}):''}
    </section>
    <section class="panel widget-install">${sectionHeader(t('widgetInstallTitle'),{sub:t('widgetInstallIntro')})}
      <div class="form-actions start">${button(t('widgetDownload'),{action:'widget-download',ic:'download'})}${button(t('widgetCopy'),{action:'widget-copy',kind:'secondary',ic:'copy'})}${button(t('widgetViewCode'),{action:'widget-code',kind:'ghost',ic:'code'})}</div>
      <div id="widget-code-panel" class="field" hidden><label class="field-label" for="widget-source">${t('widgetCodeLabel')}</label><textarea id="widget-source" class="input code" readonly spellcheck="false"></textarea></div>
      <ol class="steps">${[1,2,3,4,5].map(n=>`<li><span class="step-index num">${n}</span><p>${t('widgetStep'+n)}${n===1?` <a class="inline-link" href="https://scriptable.app/" target="_blank" rel="noopener noreferrer">Scriptable${icon('external-link')}</a>`:''}</p></li>`).join('')}</ol>
      ${notice(t('widgetRefreshLimit'),{ic:'info-circle'})}
    </section></div>
    <section class="panel">${sectionHeader(t('widgetSyncTitle'),{sub:t('widgetSyncBody')})}<div class="sync-grid"><div>${icon('device-mobile')}<h3>${t('widgetToPhone')}</h3><p>${t('widgetToPhoneBody')}</p></div><div>${icon('database-import')}<h3>${t('widgetToApp')}</h3><p>${t('widgetToAppBody')}</p>${button(t('settings'),{href:'#settings',kind:'ghost',size:'sm',iconEnd:'arrow-right'})}</div></div><p class="footnote">${t('widgetPrivacy')}</p></section>`;
}
