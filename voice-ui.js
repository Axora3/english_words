import {icon} from './icons.js';
import { recognitionConstructor } from './speech.js';
import {u} from './premium.js';
import {iconTile} from './ui.js';

export function voicePanel(word, result, { t, esc }) {
  const supported = Boolean(recognitionConstructor(window));
  const status = result?.wordId === word.id ? result : { status: 'idle' };
  const errors = { 'not-allowed': 'micDenied', 'service-not-allowed': 'micDenied', 'audio-capture': 'micNoDevice', 'no-speech': 'micNoSpeech', network: 'micNetwork', 'language-not-supported': 'micUnsupported', aborted: 'micStopped' };
  let feedback = '';
  if (status.status === 'listening') feedback = `<p class="voice-live" role="status"><span class="mic-pulse" aria-hidden="true"></span>${t('micListening')}</p>`;
  else if (status.status === 'result') feedback = `<div class="feedback ${status.matched ? 'is-correct' : 'is-wrong'}" role="status">${icon(status.matched ? 'circle-check' : 'alert-circle')}<div><small>${t('micHeard')}</small><strong lang="en">“${esc(status.transcript)}”</strong><p>${t(status.matched ? 'micMatched' : 'micMismatch')}</p></div></div>`;
  else if (status.status === 'error') feedback = `<div class="feedback is-wrong" role="alert">${icon('alert-triangle')}<div><p>${t(errors[status.error] || 'micFailed')}</p></div></div>`;
  else if (status.status === 'stopped') feedback = `<p class="voice-note" role="status">${t('micStopped')}</p>`;
  const listening = status.status === 'listening';
  return `<section class="voice-panel${listening ? ' is-listening' : ''}" aria-labelledby="voice-title-${word.id}">
    <div class="voice-head">${iconTile('microphone','speaking')}<div><h3 id="voice-title-${word.id}">${t('pronunciationPractice')}</h3><p>${t('pronunciationSub')}</p></div></div>
    <div class="voice-actions">
      <button class="btn secondary" type="button" data-action="slow:${word.id}">${icon('volume')}<span>${t('listenSlow')}</span></button>
      <button class="btn ${listening ? 'danger' : 'primary'}" type="button" data-action="${listening ? 'mic-stop' : 'mic-start:' + word.id}" ${supported ? '' : 'disabled'}>${listening ? icon('player-stop') + `<span>${t('micStop')}</span>` : icon('microphone') + `<span>${t(status.status === 'result' || status.status === 'error' ? 'micTry' : 'micStart')}</span>`}</button>
    </div>
    ${!supported ? `<p class="voice-unsupported">${icon('info-circle')}${t('micUnsupported')}</p>` : ''}${feedback}
    <p class="voice-note">${t('micAccuracy')} ${t('micPrivacy')}</p>
  </section>`;
}

/** Audio player: one primary play control plus clearly labelled playback options. */
export function audioActions(word, { t, state }) {
  const lang = state?.settings.language || 'en', label = key => u({settings:{language:lang}}, key);
  const option = (action, ic, text, title) => `<button type="button" class="audio-option" data-action="${action}:${word.id}" title="${title}">${icon(ic)}<span>${text}</span></button>`;
  return `<div class="audio-player reading-actions" role="group" aria-label="${t('pronounce')}">
    <button type="button" class="audio-play" data-action="speak:${word.id}" aria-label="${t('pronounce')}">${icon('player-play', {filled: false, className: 'when-idle'})}<span class="audio-eq when-playing" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>
    <div class="audio-copy"><strong id="audio-status" role="status">${label('idleAudio')}</strong><span lang="en" class="audio-ipa">${word.ipa || ''}</span></div>
    <div class="audio-options">
      ${option('slow', 'volume', label('slow'), t('listenSlow'))}
      ${word.example ? option('word-example', 'quote', label('example'), t('listenExample')) : ''}
      ${word.usage ? option('word-usage', 'list-details', label('usage'), t('listenUsage')) : ''}
      ${word.example ? option('word-full', 'volume-2', label('all'), t('listenFull')) : ''}
    </div>
    <button type="button" class="icon-btn audio-stop" data-action="audio-stop" aria-label="${t('stopAudio')}" data-tooltip="${t('stopAudio')}">${icon('player-stop')}</button>
  </div>`;
}
