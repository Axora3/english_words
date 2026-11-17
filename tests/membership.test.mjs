// The membership gate decides whether the whole app is replaced by the purchase screen, so what it
// does with an *unknown* answer matters as much as what it does with a known one. An app that works
// offline must not lock its own data away because a request failed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MembershipUI} from '../membership-ui.js';
import {emptyState} from '../core.js';

const gate = status => {
  const ui = new MembershipUI({state: () => emptyState(), user: () => ({id: 'u1'}), render: () => {}});
  if (status !== undefined) { ui.status = status; ui.checkedAt = Date.now(); }
  return ui;
};
const live = extra => ({active: true, gate_enabled: false, banned: false, unlimited: false,
  expires_at: null, price: 5000, coin_price: 100000, coins: 0, streak: 0, streak_days: 7,
  discount_percent: 0, purchase_url: null, ...extra});

test('an unknown membership never locks the app', () => {
  assert.equal(gate().blocked(), false, 'before the first answer arrives');
  const failed = gate();
  failed.error = 'Эрхийн шинэчлэл хараахан идэвхжээгүй байна.';
  assert.equal(failed.blocked(), false, 'when the server has no membership function yet');
});

test('with the gate switched off every signed-in account is let through', () => {
  assert.equal(gate(live()).blocked(), false);
  assert.equal(gate(live({active: false})).blocked(), false, 'sales are off, so nothing is owed');
  assert.equal(gate(live({active: false, expires_at: '2020-01-01T00:00:00Z'})).blocked(), false);
});

test('with the gate switched on only a live membership gets in', () => {
  const on = extra => gate(live({gate_enabled: true, ...extra})).blocked();
  assert.equal(on({active: true, expires_at: new Date(Date.now() + 86400000).toISOString()}), false, 'paid up');
  assert.equal(on({active: true, unlimited: true, expires_at: null}), false, 'unlimited');
  assert.equal(on({active: false}), true, 'never paid');
  assert.equal(on({active: true, expires_at: '2020-01-01T00:00:00Z'}), true, 'expired while the page was open');
});

test('a banned account is stopped whether the gate is on or off', () => {
  assert.equal(gate(live({banned: true})).blocked(), true);
  assert.equal(gate(live({banned: true, gate_enabled: true, unlimited: true})).blocked(), true);
});

test('a stale answer is refreshed in the background, not treated as a lock', async () => {
  const ui = gate(live({gate_enabled: true, active: true, expires_at: new Date(Date.now() + 86400000).toISOString()}));
  ui.checkedAt = Date.now() - 3600000;
  let loads = 0;
  ui.load = async () => { loads++; };
  assert.equal(ui.blocked(), false, 'the last known answer still applies while the new one is fetched');
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(loads, 1, 'and a refresh was asked for');
});
