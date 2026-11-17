// Players screen (#leaderboard): your public profile — level, XP, coins, rank — the leaderboard of
// everyone signed in, and which device the account is currently active on.
//
// Every number here is computed in the database from the learning document you have already synced
// (ew_sync_profile), never sent up by this file: the browser cannot award itself a level or a coin.
import {icon} from './icons.js';
import {u} from './labels.js';
import {community, cloudConfig} from './cloud.js';
import {button, pageHeader, sectionHeader, notice, badge, progressBar, iconTile, esc, pct} from './ui.js';

/** XP needed to reach a level, matching ew_level_for_xp() in the migration: level = √xp / 10 + 1. */
export const xpForLevel = level => Math.pow((Math.max(1, level) - 1) * 10, 2);
export function levelProgress(level, xp) {
  const from = xpForLevel(level), to = xpForLevel(level + 1);
  return {from, to, percent: pct(Math.max(0, xp - from), Math.max(1, to - from)), remaining: Math.max(0, to - xp)};
}

/** A name for this device that means something in a list: "Windows · Edge", "Android · Chrome". */
export function deviceLabel(scope = globalThis) {
  const nav = scope.navigator || {}, agent = nav.userAgent || '';
  const platform = nav.userAgentData?.platform
    || (/iPhone|iPad|iPod/i.test(agent) ? 'iOS' : /Android/i.test(agent) ? 'Android'
      : /Windows/i.test(agent) ? 'Windows' : /Mac/i.test(agent) ? 'Mac' : /Linux/i.test(agent) ? 'Linux' : 'Device');
  const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\//.test(agent) ? 'Opera' : /Firefox\//.test(agent) ? 'Firefox'
    : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : '';
  return (browser ? `${platform} · ${browser}` : platform).slice(0, 80);
}

export class CommunityUI {
  constructor(ctx) {
    this.ctx = ctx; this.configured = null; this.stats = null; this.board = null;
    this.device = null; this.busy = ''; this.message = null; this.draftHandle = null;
    cloudConfig().then(c => { this.configured = Boolean(c); ctx.render(); });
  }
  get state() { return this.ctx.state(); }
  get t() { return this.ctx.t(); }
  L(k) { return u(this.state, k); }
  get user() { return this.ctx.sync()?.snapshot()?.user || null; }

  async run(action, fn) {
    if (this.busy) return;
    const owner=this.user?.id,operation={};this.operation=operation;
    const guard=()=>{if(this.user?.id!==owner||this.operation!==operation)throw Object.assign(Error('Account changed'),{code:'stale-account'});};
    this.busy = action; this.message = null; this.ctx.render();
    try { await fn(guard); } catch (e) {
      if(e?.code==='stale-account'||this.operation!==operation)return;
      const offline = !navigator.onLine || /failed to fetch|network|load failed/i.test(e?.message || '');
      this.message = {text: offline ? this.L('needsInternet') : e?.message || String(e), tone: 'tone-danger'};
    } finally { if(this.operation===operation){this.busy = ''; this.ctx.render();} }
  }

  /** Publishes this device's progress, then reads the board back. Safe to call on every visit. */
  async load({handle = null, force = false} = {}) {
    if (!this.user || (this.board && !force)) return;
    await this.run('load', async guard => {
      const stats = await community.syncProfile(handle,this.user.id);guard();this.stats=stats;
      const board = await community.leaderboard(50);guard();this.board=board;
      const device = await community.deviceStatus(this.ctx.deviceId()).catch(() => null);guard();this.device=device;
      this.draftHandle = null;
    });
  }

  async click(action, value) {
    if (action === 'community-refresh') { await this.load({force: true}); return true; }
    if (action === 'community-claim') {
      await this.run('claim', async guard => {
        await community.claimDevice(this.ctx.deviceId(), deviceLabel(),this.user.id);guard();
        const device = await community.deviceStatus(this.ctx.deviceId(),this.user.id);guard();this.device=device;
        this.message = {text: this.L('deviceClaimed'), tone: 'tone-mint'};
        this.ctx.sync()?.syncNow?.();
      });
      return true;
    }
    if (action === 'community-rename') { this.draftHandle = this.stats?.handle || ''; this.ctx.render(); return true; }
    if (action === 'community-cancel') { this.draftHandle = null; this.ctx.render(); return true; }
    return false;
  }

  input(target) {
    if (target.id !== 'community-handle') return false;
    this.draftHandle = target.value;
    return true;
  }

  async submit(form) {
    if (form.id !== 'community-handle-form') return false;
    const handle = String(new FormData(form).get('handle') || '').trim().slice(0, 40);
    if (!handle) { this.message = {text: this.L('handleHelp'), tone: 'tone-danger'}; this.ctx.render(); return true; }
    await this.load({handle, force: true});
    return true;
  }

  view() {
    const L = k => this.L(k);
    const head = pageHeader({eyebrow: L('community'), title: L('leaderboard'), sub: L('leaderboardSub')});
    const msg = this.message ? notice(esc(this.message.text), {tone: this.message.tone, ic: this.message.tone === 'tone-danger' ? 'alert-triangle' : 'circle-check', role: 'status'}) : '';
    if (this.configured === null) return head + `<div class="skeleton-group" aria-busy="true"><span class="skeleton"></span><span class="skeleton"></span></div>`;
    if (!this.configured) return head + notice(`<strong>${L('cloudOff')}</strong> ${L('leaderboardNeedsCloud')}`, {ic: 'cloud-off'});
    if (!this.user) {
      return head + `<section class="panel empty-state">${iconTile('trophy', 'context', {size: 'lg'})}
        <h2>${L('signInForLeaderboard')}</h2><p class="muted-copy">${L('signInForLeaderboardSub')}</p>
        ${button(L('signIn'), {href: '#account', iconEnd: 'arrow-right'})}</section>`;
    }
    if (!this.stats) return head + msg + `<div class="skeleton-group" aria-busy="true"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>`;
    return head + msg + this.profileCard() + this.deviceRow() + this.boardTable();
  }

  profileCard() {
    const L = k => this.L(k), s = this.stats, p = levelProgress(s.level, s.xp);
    const name = this.draftHandle === null
      ? `<strong class="player-name">${esc(s.handle)}</strong>${button(L('rename'), {action: 'community-rename', kind: 'ghost', size: 'sm', ic: 'edit'})}`
      : `<form id="community-handle-form" class="inline-form"><input class="input" id="community-handle" name="handle" maxlength="40" required value="${esc(this.draftHandle)}" aria-label="${esc(L('handle'))}">
         ${button(this.t('p.save'), {size: 'sm', ic: 'check'})}${button(this.t('p.cancel'), {action: 'community-cancel', kind: 'ghost', size: 'sm'})}</form>`;
    const stat = (value, label, ic) => `<div class="player-stat">${icon(ic)}<strong class="num">${value}</strong><small>${label}</small></div>`;
    return `<section class="panel player-card">
      <div class="player-head"><span class="level-badge num" aria-label="${esc(L('level'))} ${s.level}">${s.level}</span>
        <div class="player-id">${name}<small>${L('rank')} ${s.rank} / ${s.players}</small></div>
        ${button(L('refreshStats'), {action: 'community-refresh', kind: 'secondary', size: 'sm', ic: 'refresh'})}</div>
      <div class="level-line">${progressBar(p.percent, {label: `${L('level')} ${s.level}`, tone: 'tone-mint'})}
        <small class="key-hint">${L('nextLevel')}: ${p.remaining} XP</small></div>
      <div class="player-stats">${stat(s.coins, L('coins'), 'award')}${stat(s.xp, 'XP', 'bolt')}${stat(s.words_learned, L('totalLearned'), 'book-2')}${stat(s.lessons, this.t('grammar'), 'school')}</div>
    </section>`;
  }

  deviceRow() {
    const L = k => this.L(k), d = this.device;
    if (!d) return '';
    if (d.active) return `<p class="key-hint center">${icon('device-mobile')}${L('deviceActiveHere')}${d.label ? ` · ${esc(d.label)}` : ''}</p>`;
    return `<section class="panel device-warning">
      ${notice(`<strong>${L('deviceElsewhere')}</strong> ${L('deviceElsewhereHelp')}${d.label ? ` (${esc(d.label)})` : ''}`, {tone: 'tone-warning', ic: 'alert-triangle', role: 'status'})}
      ${button(L('useThisDevice'), {action: 'community-claim', kind: 'secondary', ic: 'device-mobile'})}</section>`;
  }

  boardTable() {
    const L = k => this.L(k), me = this.user?.id;
    const rows = (this.board || []).map((row, index) => `<li class="${row.user_id === me ? 'is-me' : ''}">
        <span class="board-rank num">${index + 1}</span>
        <span class="level-badge small num">${row.level}</span>
        <span class="board-name">${esc(row.handle)}${row.user_id === me ? ` <small>${L('you')}</small>` : ''}</span>
        <span class="board-xp num">${row.xp}<small> XP</small></span>
        <span class="board-coins num">${icon('award')}${row.coins}</span></li>`).join('');
    return `<section class="panel">${sectionHeader(L('leaderboard'), {sub: L('leaderboardNote')})}
      <ol class="board-list">${rows || `<li class="muted-copy">${L('noPlayers')}</li>`}</ol></section>`;
  }
}
