// The HUD, written only where a value changed.
import { SIDES, ROUNDS_TO_WIN } from './config.js';
import { sideOf } from './state.js';
import { heldItem } from './actors.js';
import { inaccuracy } from './combat.js';
import { zoneAt } from './mapdata.js';
import { GRENADES } from './weapons.js';

const $ = (id) => document.getElementById(id);
const REASONS = { elimination: 'Squad eliminated', detonation: 'Charge detonated', defuse: 'Charge defused', time: 'Time ran out' };

const memo = (node, key, value) => { const c = node.memo || (node.memo = {}); if (c[key] === value) return false; c[key] = value; return true; };
const text = (node, v) => { if (memo(node, 't', v)) node.textContent = v; };
const style = (node, prop, v) => { if (memo(node, prop, v)) node.style.setProperty(prop, v); };
const toggle = (node, cls, on) => { if (memo(node, cls, on)) node.classList.toggle(cls, on); };
const show = (node, on) => { if (memo(node, 'shown', on)) node.hidden = !on; };
const clock = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const make = (parent, n, label) => Array.from({ length: n }, (_, i) => { const li = document.createElement(parent.tagName === 'DIV' ? 'i' : 'li'); if (label) li.textContent = label[i]; parent.appendChild(li); return li; });

export function createHud() {
  const el = new Proxy({}, { get: (cache, id) => cache[id] || (cache[id] = $(id)) });
  const pips = [make(el['pips-0'], 5), make(el['pips-1'], 5)];
  const feed = make(el.killfeed, 5);
  const slots = make(el.slots, 4, ['1 Primary', '2 Sidearm', '3 Knife', '4 Utility']);
  const arcs = Array.from(el.dmg.children, (node) => ({ node, time: -99, angle: 0 }));
  let arcHead = 0, hitTime = -99, hitHead = false, feedStamp = -1, radioAt = -99;

  function handle(e, state, viewer) {
    if (e.type === 'hurt' && e.other === state.player && e.actor !== state.player) { hitTime = performance.now(); hitHead = e.flag; }
    if (e.type === 'hurt' && e.actor === viewer && e.other) {
      const a = arcs[arcHead];
      arcHead = (arcHead + 1) % arcs.length;
      a.time = performance.now();
      a.angle = Math.atan2(e.other.pos.x - viewer.pos.x, e.other.pos.z - viewer.pos.z);
    }
    if (e.type === 'roundEnd') {
      const side = SIDES[state.match.side[state.round.winner]], mvp = state.round.mvp;
      text(el['banner-title'], `${side.name} win${state.match.over ? ' the match' : ''}`);
      text(el['banner-sub'], REASONS[state.round.reason] + (mvp ? `  ·  MVP ${mvp.name}, ${mvp.stats.roundKills} kill${mvp.stats.roundKills === 1 ? '' : 's'}` : ''));
      el.banner.style.setProperty('--banner', side.css);
      show(el.banner, true);
    }
    if (e.type === 'roundStart') show(el.banner, false);
    if (e.type === 'callout' && e.actor.squad === state.player.squad && !e.actor.isPlayer) {
      radioAt = state.time;
      text(el.radio, `${e.actor.name}: contact, ${zoneAt(e.x, e.z)}`);
    }
  }

  function update(state, view) {
    const me = state.player, who = view.viewer, r = state.round, m = state.match, c = state.charge;
    for (let s = 0; s < 2; s += 1) {
      text(el['score-' + s], String(m.score[s]));
      text(el['team-' + s], SIDES[m.side[s]].short);
      style(document.documentElement, '--side-' + s, SIDES[m.side[s]].css);
      let k = 0;
      for (const a of state.actors) if (a.squad === s) toggle(pips[s][k++], 'dead', !a.alive);
    }
    const planted = r.phase === 'planted', mySide = sideOf(state, me);
    text(el.timer, clock(r.phase === 'freeze' || r.phase === 'live' ? r.clock : planted ? c.fuse : 0));
    toggle(el.timer, 'charge', planted);
    toggle(el.timer, 'freeze', r.phase === 'freeze');
    text(el['round-label'], `Round ${m.round} of ${ROUNDS_TO_WIN * 2 - 1}  ·  ${mySide === 'atk' ? 'Attack' : 'Defend'}`);
    show(el.radio, state.time - radioAt < 3 && (r.phase === 'live' || r.phase === 'planted'));
    let msg = '';
    if (r.phase === 'freeze') msg = `Buy phase  ·  B to buy  ·  ${SIDES[mySide].name}`;
    else if (planted) msg = `Charge planted at Site ${c.site}`;
    else if (r.phase === 'live' && r.elapsed < 4) msg = mySide === 'atk' ? 'Take a site, plant the charge' : 'Hold the sites';
    if (!me.alive && r.phase !== 'post') msg = who !== me ? `Spectating ${who.name}` : 'Eliminated';
    if (me.alive && c.carrier === me && view.onSite) msg = 'Hold E to plant the charge';
    if (me.alive && planted && mySide === 'def' && me.pos.distanceTo(c.pos) < 2.5 && c.defuser !== me) msg = 'Hold E to defuse';
    text(el['phase-msg'], msg);
    text(el.zone, zoneAt(who.pos.x, who.pos.z));

    const latest = state.killfeed[(state.killHead + 4) % 5].time;
    if (latest !== feedStamp || state.tick % 60 === 0) {
      feedStamp = latest;
      feed.forEach((li, i) => { // newest first, walking the ring backwards
        const k = state.killfeed[(state.killHead + 4 - i) % 5];
        li.hidden = !(k.time >= 0 && state.time - k.time < 9);
        if (li.hidden) return;
        li.className = k.killer === me.name || k.victim === me.name ? 'mine' : '';
        li.innerHTML = `<span class="c-${m.side[k.killerSquad]}">${k.killer}</span><span class="w">${k.weapon}</span>${k.head ? '<span class="hs">◎</span>' : ''}<span class="c-${m.side[k.victimSquad]}">${k.victim}</span>`;
      });
    }

    text(el['money-value'], me.money.toLocaleString('en-US'));
    text(el.hp, String(who.hp));
    text(el.ap, String(Math.round(who.armor)));
    style(el['hp-bar'], 'width', who.hp + '%');
    style(el['ap-bar'], 'width', Math.round(who.armor) + '%');
    toggle(el.hp.parentElement, 'low', who.hp <= 25);
    const item = heldItem(who), g = who.grenades;
    const slot = ['primary', 'secondary', 'knife', 'grenade'].indexOf(who.slot);
    for (let i = 0; i < 4; i += 1) toggle(slots[i], 'on', i === slot);
    if (item) {
      text(el['weapon-name'], item.def.name + (who.gun.reload > 0 ? '  ·  reloading' : ''));
      text(el.mag, item.def.mag ? String(item.mag) : '–');
      text(el.reserve, item.def.mag ? `/ ${item.reserve}` : '');
    } else {
      text(el['weapon-name'], GRENADES[who.grenadeType].name);
      text(el.mag, String(g[who.grenadeType]));
      text(el.reserve, `F${g.frag} S${g.smoke} G${g.flash}`);
    }
    toggle(el.ammo, 'low', !!item && item.def.mag > 0 && item.mag <= item.def.mag * 0.2);
    // only attackers know the carrier
    const known = mySide === 'atk' || planted;
    text(el['charge-tag'], c.defuser ? 'Charge \u00b7 defusing' : planted ? `Charge \u00b7 planted ${c.site}` : c.state === 'dropped' && known ? 'Charge \u00b7 dropped' : c.carrier && known ? `Charge \u00b7 ${c.carrier === me ? 'you carry it' : c.carrier.name}` : '');
    show(el['charge-tag'], (r.phase === 'live' || planted) && known);
    text(slots[3], `4 Utility \u00d7${g.frag + g.smoke + g.flash}`);

    const gap = 4 + Math.tan(inaccuracy(who)) / Math.tan(view.fov * Math.PI / 360) * (view.height / 2);
    style(el.crosshair, '--gap', Math.min(80, gap).toFixed(1) + 'px');
    toggle(el.crosshair, 'hidden', who.gun.scoped || !who.alive);
    const now = performance.now();
    toggle(el.hitmarker, 'on', view.shot ? hitTime > 0 : now - hitTime < 140);
    toggle(el.hitmarker, 'head', hitHead);
    const facing = Math.atan2(-Math.sin(who.yaw), -Math.cos(who.yaw));
    for (const a of arcs) {
      const age = (now - a.time) / 1000;
      style(a.node, 'opacity', view.shot ? (a.time > 0 ? '0.9' : '0') : Math.max(0, 1 - age / 1.4).toFixed(2));
      style(a.node, 'transform', `rotate(${((facing - a.angle) * 180 / Math.PI).toFixed(1)}deg)`);
    }
    const busy = (c.planter === who && r.phase === 'live') || (c.defuser === who && planted);
    show(el.progress, busy);
    if (busy) {
      text(el['progress-label'], c.planter === who ? 'Planting charge' : who.kit ? 'Defusing  ·  kit' : 'Defusing');
      style(el['progress-fill'], 'width', Math.min(100, c.progress * 100).toFixed(1) + '%');
    }
    show(el.scope, who.gun.scoped && who.alive);
    style(el.flashout, 'opacity', who.blind > 0 ? Math.min(1, who.blind / Math.max(0.5, who.blindMax) * 1.6).toFixed(2) : '0');
    style(el['hurt-vignette'], 'opacity', who.alive ? Math.max(0, 1 - (state.time - who.lastHit) / 0.6).toFixed(2) : '0');
  }

  return { update, handle };
}
