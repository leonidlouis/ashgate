// The screens around the fight: title and pause with settings, the buy menu (categories, prices,
// greyed out when you cannot afford or carry more), the Tab scoreboard and the match summary.
import { BUY_MENU, WEAPONS, GRENADES, GEAR } from './weapons.js';
import { SIDES, ROUND } from './config.js';
import { buy, buyBlock, priceOf, canBuy } from './economy.js';

const $ = (id) => document.getElementById(id);

function statLine(entry) {
  if (entry.type === 'weapon') {
    const w = WEAPONS[entry.id];
    return `DMG ${w.damage}${w.pellets > 1 ? '×' + w.pellets : ''} · ${Math.round(60 / w.interval)} RPM · ${w.mag} RND · KILL $${w.reward}`;
  }
  if (entry.type === 'grenade') return { frag: 'Blast, falls off behind cover', smoke: 'Blocks sight for 17 s', flash: 'Blinds whoever looks at it' }[entry.id];
  return { vest: '100 armour, chest only', helmet: '100 armour, saves the head', kit: 'Defuse in 3 s, not 5' }[entry.id];
}

function nameOf(entry) {
  return entry.type === 'weapon' ? WEAPONS[entry.id].name : entry.type === 'grenade' ? GRENADES[entry.id].name : GEAR[entry.id].name;
}

export function createScreens(state, hooks) {
  const ids = { title: 'title', play: 'play', buy: 'buy', grid: 'buy-grid', money: 'buy-money', buyTimer: 'buy-timer', board: 'board', boardRows: 'board-rows', boardScore: 'board-score',
    end: 'match-end', endTitle: 'end-title', endKicker: 'end-kicker', endSub: 'end-sub', endRows: 'end-rows', restart: 'restart', sens: 'set-sens', vol: 'set-vol', diff: 'set-diff' };
  const el = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, $(id)]));
  // buy grid, built once
  const buttons = [];
  let n = 0;
  for (const group of BUY_MENU) {
    const col = el.grid.appendChild(document.createElement('div'));
    col.innerHTML = `<h3>${group.title}</h3>`;
    for (const entry of group.items) {
      n += 1;
      const b = col.appendChild(document.createElement('button'));
      b.className = 'item';
      b.innerHTML = `<span class="n">${nameOf(entry)}</span><span class="p"></span><span class="s">${statLine(entry)}</span><span class="k">${n < 10 ? n : 0}</span>`;
      b.addEventListener('click', () => { if (buy(state, state.player, entry)) hooks.ui(); });
      buttons.push({ b, entry, price: b.querySelector('.p'), last: '' });
    }
  }

  const s = hooks.settings;
  el.sens.value = s.sensitivity; el.vol.value = s.volume; el.diff.value = s.difficulty;
  el.sens.addEventListener('input', () => { s.sensitivity = +el.sens.value; hooks.saveSettings(); });
  el.vol.addEventListener('input', () => { s.volume = +el.vol.value; hooks.saveSettings(); });
  el.diff.addEventListener('change', () => { s.difficulty = el.diff.value; hooks.saveSettings(); });
  el.play.addEventListener('click', () => hooks.play());
  el.restart.addEventListener('click', () => hooks.restart());

  let buyOpen = false;
  function setBuy(open) {
    buyOpen = open && canBuy(state, state.player);
    el.buy.hidden = !buyOpen;
    return buyOpen;
  }
  function buyByIndex(i) {
    const item = buttons[i];
    if (item && buy(state, state.player, item.entry)) hooks.ui();
  }

  function rows(body, withMoney) {
    const list = state.actors.slice().sort((a, b) => a.squad - b.squad || b.stats.kills - a.stats.kills);
    body.innerHTML = list.map((a) => {
      const side = state.match.side[a.squad];
      return `<tr class="${a.isPlayer ? 'me' : ''} ${a.alive ? '' : 'dead'}"><td class="sq c-${side}">${SIDES[side].short}</td><td>${a.name}</td><td>${a.stats.kills}</td><td>${a.stats.deaths}</td><td>${a.stats.damage}</td><td>${a.stats.mvps ? '★'.repeat(Math.min(a.stats.mvps, 5)) : ''}</td>${withMoney ? `<td>${a.squad === state.player.squad ? '$' + a.money : ''}</td>` : ''}</tr>`;
    }).join('');
  }

  function showBoard(on) {
    el.board.hidden = !on;
    if (on) {
      rows(el.boardRows, true);
      el.boardScore.textContent = `${state.match.score[0]} : ${state.match.score[1]}  ·  round ${state.match.round}`;
    }
  }

  function showEnd() {
    const m = state.match;
    const won = m.winner === state.player.squad;
    el.endKicker.textContent = `Saltworks  ·  ${m.round} rounds`;
    el.endTitle.textContent = won ? 'Victory' : 'Defeat';
    el.endTitle.style.color = won ? 'var(--hazard)' : 'var(--danger)';
    const best = state.actors.reduce((a, b) => (b.stats.mvps > a.stats.mvps || (b.stats.mvps === a.stats.mvps && b.stats.kills > a.stats.kills) ? b : a));
    el.endSub.innerHTML = `Your squad <b>${m.score[state.player.squad]}</b> – <b>${m.score[1 - state.player.squad]}</b> rivals. Match MVP: <b>${best.name}</b>, ${best.stats.kills} kills, ${best.stats.mvps} round MVPs.`;
    rows(el.endRows, false);
    el.end.hidden = false;
    $('banner').hidden = true;
  }

  /** Per frame while the buy menu is open: prices, affordability, the closing clock. */
  function update(hot) {
    if (!buyOpen) return;
    if (!canBuy(state, state.player)) { setBuy(false); return; }
    el.money.textContent = '$' + state.player.money.toLocaleString('en-US');
    const left = state.round.phase === 'freeze' ? state.round.clock + ROUND.buyWindow - ROUND.freeze : ROUND.buyWindow - ROUND.freeze - state.round.elapsed;
    el.buyTimer.textContent = `Closes in ${Math.ceil(left)} s  ·  B to close`;
    buttons.forEach((item, i) => {
      const block = buyBlock(state, state.player, item.entry);
      const label = block === 'Owned' || block === 'Carrying max' || block === 'Pouch full' ? block : '$' + priceOf(state.player, item.entry);
      if (label !== item.last) { item.last = label; item.price.textContent = label; }
      item.b.disabled = !!block;
      item.b.classList.toggle('hot', i === hot);
    });
  }

  return {
    setBuy, buyByIndex, update, showBoard, showEnd,
    get buyOpen() { return buyOpen; },
    showTitle(paused) {
      el.title.hidden = false;
      el.play.textContent = paused ? 'Resume' : 'Click to play';
    },
    hideTitle() { el.title.hidden = true; },
    hideEnd() { el.end.hidden = true; },
  };
}
