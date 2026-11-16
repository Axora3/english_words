import {icon} from './icons.js';
import {u} from './premium.js';
import { lessons } from './grammar-data.js';
import { levels, availableLessons, currentLesson, lessonUnlockDate } from './grammar.js';
import {button,pageHeader,sectionHeader,progressBar,progressRing,cefr,badge,quizOption,feedback,notice,iconTile,pct} from './ui.js';

export function grammarPage(state, { t, esc, dateLabel, level: chosen }) {
  const L = k => u(state, k), grammar = state.grammar, available = availableLessons(grammar);
  const selectedId = location.hash.slice(1).split('/')[1];
  const selectedIndex = lessons.findIndex(lesson => lesson.id === selectedId);
  const selected = selectedIndex >= 0 && selectedIndex < available ? lessons[selectedIndex] : null;
  if (selected) return lessonPage(selected, selectedIndex, state, { t, esc });
  const current = currentLesson(grammar), completed = grammar ? Object.keys(grammar.completed).length : 0;
  const next = grammar && available < lessons.length ? lessonUnlockDate(grammar, available) : null;
  const level = chosen && levels.includes(chosen) ? chosen : current?.level || 'A1';
  const fmt = d => dateLabel(d, {year: 'numeric', month: 'short', day: 'numeric'});
  const levelStats = levels.map(lv => { const group = lessons.filter(l => l.level === lv); return {lv, total: group.length, done: group.filter(l => grammar?.completed[l.id]).length}; });
  const ramp = `<ol class="level-ramp">${levelStats.map(s => `<li class="${s.lv === (current?.level || 'A1') ? 'is-current' : ''}">${cefr(s.lv)}${progressBar(pct(s.done, s.total), {label: s.lv, size: 'thin', tone: s.done === s.total ? 'tone-mint' : ''})}<small class="num">${s.done}/${s.total}</small></li>`).join('')}</ol>`;
  const hero = !grammar ? `<section class="course-hero">
      <div class="course-copy"><p class="eyebrow">A1 → C1 · 100 ${L('lesson').toLowerCase()}</p><h2>${L('courseIntro')}</h2><p class="muted-copy">${t('grammarIntro')}</p><p class="key-hint">${icon('calendar-event')}${t('grammarCadence')}</p><div class="hero-actions">${button(t('grammarStart'), {action: 'grammar-start', size: 'lg', iconEnd: 'arrow-right'})}</div></div>
      <div class="course-side">${iconTile('school', 'context', {size: 'lg'})}</div>${ramp}</section>`
    : `<section class="course-hero">
      <div class="course-copy"><p class="eyebrow">${icon('calendar-event')}${L('thisWeek')}</p>${current ? `<p class="course-level">${cefr(current.level)}<span>${t('grammarWeek')} <b class="num">${lessons.indexOf(current) + 1}</b></span>${grammar.completed[current.id] ? badge(t('done'), 'tone-mint') : ''}</p><h2>${esc(current.title[state.settings.language])}</h2>` : ''}
      <p class="muted-copy">${next ? `${t('grammarNext')}: <time>${fmt(next)}</time>` : t('grammarAllUnlocked')}</p>
      <div class="hero-actions">${current ? button(t(grammar.completed[current.id] ? 'grammarRead' : 'grammarOpen'), {action: `go:grammar/${current.id}`, size: 'lg', iconEnd: 'arrow-right'}) : ''}</div></div>
      <div class="course-side">${progressRing(pct(completed, lessons.length), {size: 128, stroke: 10, label: `${t('grammarCompleted')}: ${completed}/${lessons.length}`, center: `<strong class="num">${completed}<span>/${lessons.length}</span></strong><small>${t('grammarCompleted')}</small>`})}<dl class="facts"><div><dt>${t('grammarAvailable')}</dt><dd class="num">${available}</dd></div></dl></div>${ramp}</section>`;
  const group = lessons.filter(l => l.level === level);
  const tabs = `<div class="segmented level-tabs" role="group" aria-label="${esc(L('levels'))}">${levelStats.map(s => `<button type="button" data-action="grammar-level:${s.lv}" class="${s.lv === level ? 'active' : ''}" aria-pressed="${s.lv === level}"><span>${s.lv}</span><b class="num">${s.done}/${s.total}</b></button>`).join('')}</div>`;
  const rows = group.map(lesson => {
    const index = lessons.indexOf(lesson), unlocked = Boolean(grammar) && index < available, done = Boolean(grammar?.completed[lesson.id]), isCurrent = current?.id === lesson.id;
    const caption = done ? t('done') : unlocked ? t('available') : grammar ? `${t('grammarUnlock')} ${fmt(lessonUnlockDate(grammar, index))}` : t('locked');
    const inner = `<span class="lesson-index num">${done ? icon('check') : index + 1}</span><span class="lesson-copy"><strong>${esc(lesson.title[state.settings.language])}</strong><small>${t('grammarWeek')} ${index + 1} · ${caption}</small></span>${isCurrent ? badge(L('thisWeek'), 'tone-accent') : ''}${unlocked ? icon('chevron-right') : icon('lock', {className: 'lesson-lock'})}`;
    return `<li class="lesson-row${done ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}${unlocked ? '' : ' is-locked'}">${unlocked ? `<a href="#grammar/${lesson.id}">${inner}</a>` : `<div aria-disabled="true">${inner}</div>`}</li>`;
  }).join('');
  return `${pageHeader({eyebrow: L('course'), title: t('grammarTitle'), sub: t('grammarSub')})}
    ${selectedId ? notice(t('grammarLocked'), {ic: 'lock', tone: 'tone-warning'}) : ''}${hero}
    <section class="syllabus">${sectionHeader(t('grammarSyllabus'), {action: tabs})}<ol class="lesson-list" data-level="${level}">${rows}</ol></section>
    ${notice(`${t('grammarNote')} <a href="https://learnenglish.britishcouncil.org/free-resources/grammar" target="_blank" rel="noopener noreferrer" class="inline-link">${t('grammarSource')}${icon('external-link')}</a>`)}`;
}

function lessonPage(lesson, index, state, { t, esc }) {
  const language = state.settings.language, L = k => u(state, k), attempt = state.grammar.attempts[lesson.id], done = Boolean(state.grammar.completed[lesson.id]);
  const prev = lessons[index - 1], next = lessons[index + 1], nextOpen = next && index + 1 < availableLessons(state.grammar);
  const questions = lesson.questions.map((question, i) => `<fieldset class="exercise"><legend><span class="exercise-index num">${i + 1}</span>${t(question.type === 'gap' ? 'grammarGap' : 'grammarSentence')}</legend>
      ${question.prompt ? `<p class="exercise-prompt" lang="en">${esc(question.prompt)}</p>` : ''}
      <div class="quiz-options">${question.options.map((option, j) => quizOption({name: 'q' + i, value: j, key: 'ABC'[j], label: esc(option), lang: 'en', disabled: Boolean(attempt), checked: attempt?.answers[i] === j, state: attempt ? (j === question.correct ? (attempt.answers[i] === j ? 'correct' : 'missed') : attempt.answers[i] === j ? 'wrong' : '') : ''})).join('')}</div>
    </fieldset>`).join('');
  const passed = attempt && attempt.score === lesson.questions.length;
  return `<a class="back-link" href="#grammar">${icon('arrow-left')}<span>${t('grammarBack')}</span></a>
    <div class="lesson-page">
      <header class="page-header"><p class="eyebrow">${cefr(lesson.level)}<span>${t('grammarWeek')} <b class="num">${index + 1}</b></span>${done ? badge(t('done'), 'tone-mint') : ''}</p><h1>${esc(lesson.title[language])}</h1></header>
      <div class="lesson-layout">
        <article class="lesson-rule">
          <section><p class="meaning-label">${t('grammarExplanation')}</p><p class="rule-text">${esc(lesson.rule[language])}</p></section>
          <section><p class="meaning-label">${t('grammarPattern')}</p><p class="formula" lang="en">${esc(lesson.pattern)}</p></section>
          <section><p class="meaning-label">${L('example')}</p><blockquote class="example"><p lang="en">${esc(lesson.example)}</p><p lang="mn">${esc(lesson.exampleMn)}</p></blockquote>${button(t('grammarListen'), {action: `grammar-audio:${lesson.id}`, kind: 'secondary', size: 'sm', ic: 'volume'})}</section>
        </article>
        <form id="grammar-form" data-lesson="${lesson.id}" class="lesson-exercises">${sectionHeader(t('grammarPractice'), {sub: `${lesson.questions.length} ${L('exercise').toLowerCase()}`})}
          ${questions}
          ${attempt ? `${feedback(passed, `<span class="num">${attempt.score} / ${lesson.questions.length}</span> · ${t(passed ? 'grammarPassed' : 'grammarTryAgain')}`, passed ? '' : esc(lesson.rule[language]))}
            <div class="form-actions">${button(t('grammarRetry'), {action: `grammar-retry:${lesson.id}`, kind: 'secondary', type: 'button', ic: 'refresh'})}${nextOpen ? button(esc(next.title[language]), {href: `#grammar/${next.id}`, iconEnd: 'arrow-right'}) : button(t('grammarBack'), {action: 'go:grammar', type: 'button'})}</div>` : button(t('grammarSubmit'), {type: 'submit', size: 'lg', full: true, ic: 'check'})}
        </form>
      </div>
      <nav class="lesson-pager" aria-label="${esc(L('lesson'))}">${prev ? `<a href="#grammar/${prev.id}">${icon('arrow-left')}<span><small>${L('lesson')} ${index}</small><strong>${esc(prev.title[language])}</strong></span></a>` : '<span></span>'}${nextOpen ? `<a class="next" href="#grammar/${next.id}"><span><small>${L('lesson')} ${index + 2}</small><strong>${esc(next.title[language])}</strong></span>${icon('arrow-right')}</a>` : ''}</nav>
    </div>`;
}
