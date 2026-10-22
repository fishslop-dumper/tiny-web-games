'use strict';
/* ==========================================================================
   60秒：地堡余生  —  模块 4/4
   DOM 界面 · 屏幕状态机 · 主循环
   ========================================================================== */

var UI = (function () {
  var SCREENS = ['title', 'brief', 'play', 'bunker', 'end'];
  var hudCache = { t: '', n: -1, fam: '', hatch: '' };

  function $(id) { return document.getElementById(id); }
  function show(name) {
    SCREENS.forEach(function (k) {
      var el = $('screen-' + k);
      if (el) el.classList.toggle('active', k === name);
    });
  }

  /* ---------------- 抢物资 HUD ---------------- */
  function hud() {
    var s = Scav.state();
    if (!s) return;
    var tEl = $('hud-timer');
    var t = s.t.toFixed(1);
    if (tEl && t !== hudCache.t) {
      hudCache.t = t;
      tEl.textContent = t;
      tEl.classList.toggle('hot', s.t <= 10);
    }
    if (s.grabbed.length !== hudCache.n) {
      hudCache.n = s.grabbed.length;
      var cEl = $('hud-count');
      if (cEl) cEl.textContent = s.grabbed.length + ' 件';
    }
    var famKey = s.following.join(',');
    if (famKey !== hudCache.fam) {
      hudCache.fam = famKey;
      var fEl = $('hud-family');
      if (fEl) fEl.innerHTML = FAMILY.filter(function (f) { return f.id !== 'ted'; }).map(function (f) {
        var on = s.following.indexOf(f.id) >= 0;
        return '<span class="' + (on ? '' : 'off') + '" title="' + f.name + '">' + f.emoji + '</span>';
      }).join(' ');
    }
    var hatch = s.nearHatch ? '就在脚下' : '— —';
    if (hatch !== hudCache.hatch) {
      hudCache.hatch = hatch;
      var hEl = $('hud-hatch');
      if (hEl) hEl.textContent = hatch;
    }
  }
  function hudReset() { hudCache = { t: '', n: -1, fam: '', hatch: '' }; }

  /* ---------------- 地堡 ---------------- */
  function gearNames(S) {
    var keys = Object.keys(S.gear);
    if (!keys.length) return '—';
    return keys.map(function (k) { return ITEMS[k].emoji + ITEMS[k].name; }).join(' ');
  }

  function memberCard(m) {
    var cls = 'mem';
    if (!m.alive) cls += ' dead';
    else if (!m.present) cls += ' absent';
    var hp = Math.round(m.hp);
    var barCls = hp > 60 ? '' : (hp > 30 ? 'mid' : 'low');
    var stat;
    if (!m.present) stat = '留在了房子里';
    else if (!m.alive) stat = '已遇难';
    else {
      var bits = [];
      if (m.sick) bits.push('🤒 生病');
      if (m.injured) bits.push('🤕 受伤');
      if (m.hunger > 0) bits.push('🍽️ 饿了' + m.hunger + '天');
      if (m.thirst > 0) bits.push('💧 渴了' + m.thirst + '天');
      if (!bits.length) bits.push('😀 还算正常');
      stat = bits.join(' · ') + ' · 体力 ' + hp;
    }
    return '<div class="' + cls + '">' +
      '<div class="av">' + m.emoji + '</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div class="nm">' + m.name + ' <em>' + m.role + '</em></div>' +
      (m.present && m.alive ? '<div class="bar"><i class="' + barCls + '" style="width:' + hp + '%"></i></div>' : '') +
      '<div class="stat">' + stat + '</div>' +
      '</div></div>';
  }

  function invHtml(S) {
    var out = '';
    var gears = Object.keys(S.gear);
    if (gears.length) {
      out += '<div class="inv"><div class="lbl">装备 · 自动生效</div>';
      gears.forEach(function (k) {
        out += '<div class="inv-item passive"><span>' + ITEMS[k].emoji + '</span><span class="nm">' + ITEMS[k].name + '</span></div>';
      });
      out += '</div>';
    }
    if (S.inv.length) {
      var canUse = (S.stage === 'ration' && !S.ended);
      out += '<div class="inv"><div class="lbl">消耗品' + (canUse || S.ended ? '' : ' · 早晨配给时可用') + '</div>';
      S.inv.forEach(function (slot) {
        var d = ITEMS[slot.key];
        var btn = canUse
          ? '<button class="use" data-act="use" data-arg="' + slot.key + '">使用</button>' : '';
        out += '<div class="inv-item"><span>' + d.emoji + '</span><span class="nm">' + d.name +
          (slot.n > 1 ? ' ×' + slot.n : '') +
          (d.effect ? '<i class="eff">' + d.effect + '</i>' : '') +
          '</span>' + btn + '</div>';
      });
      out += '</div>';
    }
    if (!gears.length && !S.inv.length) {
      out += '<div class="inv"><div class="inv-item"><span class="nm">空的。你只带下来一双空手。</span></div></div>';
    }
    return out;
  }

  function cardOpen(tag, title) {
    return '<div class="card"><div class="tag">' + tag + '</div><h3>' + title + '</h3>';
  }
  function cardClose() { return '</div>'; }

  function baseStageHtml(S) {
    var dayTag = '第 ' + S.day + ' 天';

    if (S.stage === 'ration') {
      var rows = S.members.filter(function (m) { return m.alive && m.present; }).map(function (m) {
        var r = S.ration[m.id] || { food: false, water: false };
        return '<div class="ration-row">' +
          '<div class="who">' + m.emoji + ' ' + m.name + '<small>体力 ' + Math.round(m.hp) + '</small></div>' +
          '<button class="tog food ' + (r.food ? 'on' : '') + '" data-act="ration" data-arg="' + m.id + ':food">🥫 口粮</button>' +
          '<button class="tog water ' + (r.water ? 'on' : '') + '" data-act="ration" data-arg="' + m.id + ':water">💧 水</button>' +
          '</div>';
      }).join('');
      var cost = Bunker.rationCost();
      var warn = (cost.food > S.food || cost.water > S.water) ? ' <b style="color:#8d2b1c">库存不够</b>' : '';
      return cardOpen(dayTag + ' · 早晨', '今天的配给') +
        '<p>谁吃，谁不吃。地堡里没有慈善，只有算术。</p>' +
        '<div style="margin-top:10px">' + rows + '</div>' +
        '<div class="summary">' +
        '<span>将消耗 🥫 <b>' + cost.food + '</b> · 💧 <b>' + cost.water + '</b>' +
        '（库存 🥫 ' + S.food + ' · 💧 ' + S.water + '）' + warn + '</span>' +
        '<button class="btn btn-primary" data-act="confirm">开始这一天</button>' +
        '</div>' + cardClose();
    }

    if (S.stage === 'event' && S.event) {
      var b = S.broadcast || { radio: false, text: '' };
      var choices = S.event.choices.map(function (c, i) {
        return '<button class="choice" data-act="choose" data-arg="' + i + '">' + c.label +
          (c.hint ? '<small>' + c.hint + '</small>' : '') + '</button>';
      }).join('');
      return cardOpen(dayTag + ' · 广播', S.event.title) +
        '<div class="radio-line">' + (b.radio ? '📻 <b>广播</b> · ' : '🤫 · ') + b.text + '</div>' +
        '<p>' + S.event.text + '</p>' +
        '<div class="choices">' + choices + '</div>' + cardClose();
    }

    if (S.stage === 'expedition') {
      var who = S.members.filter(function (m) { return m.alive && m.present; }).map(function (m) {
        return '<button class="choice" data-act="exp" data-arg="' + m.id + '">让 ' + m.name + ' 出去' +
          '<small>体力 ' + Math.round(m.hp) + (m.sick ? ' · 生病' : '') + (m.injured ? ' · 受伤' : '') + '</small></button>';
      }).join('');
      return cardOpen(dayTag + ' · 下午', '要不要派人出去？') +
        '<p>外面的辐射尘还没散。出去的人可能带回吃的，也可能带不回自己。' +
        '带上去的东西越齐（面具、手电、猎枪、地图），回来的把握越大。</p>' +
        '<div class="choices">' + who +
        '<button class="choice" data-act="skipexp">今天谁都不出去<small>安全，但什么也没有</small></button>' +
        '</div>' + cardClose();
    }

    if (S.stage === 'outcome' && S.outcome) {
      return cardOpen(dayTag + ' · 结果', S.outcome.title) +
        '<div class="res ' + (S.outcome.tone || '') + '">' + S.outcome.text + '</div>' +
        '<div class="summary"><span>天还没黑。</span>' +
        '<button class="btn btn-primary" data-act="advance">继续 →</button></div>' + cardClose();
    }

    if (S.stage === 'expResult' && S.outcome) {
      return cardOpen(dayTag + ' · 门外', S.outcome.title) +
        '<div class="res ' + (S.outcome.tone || '') + '">' + S.outcome.text + '</div>' +
        '<div class="summary"><span>天要黑了。</span>' +
        '<button class="btn btn-primary" data-act="advance">回地堡 →</button></div>' + cardClose();
    }

    if (S.stage === 'night' && S.outcome) {
      var lines = (S.outcome.lines || []).map(function (l) { return '<div>' + l + '</div>'; }).join('');
      return cardOpen(dayTag + ' · 夜里', S.outcome.title) +
        '<div class="res">' + lines + '</div>' +
        '<div class="summary"><span>熬过去，就是第 ' + (S.day + 1) + ' 天。</span>' +
        '<button class="btn btn-primary" data-act="advance">合眼 →</button></div>' + cardClose();
    }

    return cardOpen(dayTag, '……') + '<p>地堡里很安静。</p>' + cardClose();
  }

  function progressHtml(S) {
    var done = Util.clamp(S.day / S.goal, 0, 1);
    var left = Math.max(0, S.goal - S.day);
    return '<div class="progress">' +
      '<div class="plabel"><span>地堡生存进度</span><span>距救援 ' + left + ' 天</span></div>' +
      '<div class="pbar"><i style="width:' + (done * 100).toFixed(1) + '%"></i></div>' +
      '</div>';
  }

  function stageHtml(S) { return baseStageHtml(S) + progressHtml(S); }

  function renderBunker() {
    var S = Bunker.state();
    if (!S) return;
    $('bh-day').textContent = '第 ' + S.day + ' 天';
    $('bh-goal').textContent = '目标：撑到第 ' + S.goal + ' 天';
    $('bh-food').textContent = S.food;
    $('bh-water').textContent = S.water;
    $('bh-gear').textContent = gearNames(S);
    $('family').innerHTML = S.members.map(memberCard).join('');
    $('inv').innerHTML = invHtml(S);
    $('stage').innerHTML = stageHtml(S);
    var logEl = $('log');
    logEl.innerHTML = S.log.slice(-60).map(function (l) {
      return '<div class="l"><span class="d">D' + l.day + '</span>' + l.text + '</div>';
    }).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  /* ---------------- 结局 ---------------- */
  function endingCopy(e) {
    if (e.reason === 'nuke') {
      return {
        stamp: '三米之外',
        title: '警报停了。',
        text: '白色的光从窗户里涌进来，然后什么都没有了。避难所的门在你身后三米的地方，一直开着。'
      };
    }
    if (e.reason === 'ted-dead') {
      return {
        stamp: '第 ' + e.day + ' 天',
        title: '泰德没有醒来。',
        text: e.aliveCount > 0
          ? '地堡里的灯还亮着。剩下的人把他安置在最里面的房间，然后继续在墙上画粉笔线。'
          : '地堡里的灯还亮着。再也没有人去数墙上的粉笔线了。'
      };
    }
    var n = e.aliveCount;
    var body;
    if (n >= 4) body = '救援队找到你们时，一家四口正围着一张缺角的桌子喝汤。有人哭了，有人只是站着，谁也不肯先说话。';
    else if (n === 3) body = '三个人爬上了梯子。第四个人的名字，在接下来的很多年里都没有人主动提起。';
    else if (n === 2) body = '两个人互相扶着爬上去。地面上的太阳很亮，亮得让人想不起地堡里是什么样子。';
    else if (n === 1) body = '只有你一个人爬上了梯子。太阳晒得后脖子发烫，跟梦里一模一样。';
    else body = '救援队撬开铁门的时候，地堡里已经没有人回答了。';
    return {
      stamp: '存活 ' + e.day + ' 天',
      title: '有人敲门。',
      text: '第 ' + e.goal + ' 天的早晨，你听见锤子敲铁门的声音：三下，停一会儿，再三下。' + body
    };
  }

  function showEnding(e) {
    var c = endingCopy(e);
    $('end-stamp').textContent = c.stamp;
    $('end-title').textContent = c.title;
    $('end-text').textContent = c.text;
    var who = (e.alive || []).map(function (m) { return m.emoji + m.name; }).join(' ') || '无';
    $('end-stats').innerHTML =
      '<div><span>撑过天数</span><b>' + (e.reason === 'nuke' ? 0 : e.day) + ' / ' + e.goal + '</b></div>' +
      '<div><span>幸存者</span><b>' + (e.aliveCount || 0) + ' 人</b></div>' +
      '<div><span>带下来的物资</span><b>' + (e.brought || 0) + ' 件</b></div>' +
      '<div><span>救下来的家人</span><b>' + (e.rescued || 0) + ' / 3</b></div>' +
      '<div style="grid-column:1/-1"><span>留下来的人</span><b style="font-size:13px">' + who + '</b></div>';
    show('end');
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind(stageEl, onAction) {
    if (!stageEl || !stageEl.addEventListener) return;
    stageEl.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      onAction(b.getAttribute('data-act'), b.getAttribute('data-arg'));
    });
  }

  return {
    show: show, hud: hud, hudReset: hudReset,
    renderBunker: renderBunker, showEnding: showEnding, bind: bind, $: $
  };
})();

/* ==========================================================================
   主控
   ========================================================================== */
var Main = (function () {
  var view = 'title';
  var ctx = null, last = 0, booted = false;
  var boomTimer = null, boomDone = false, res = null;

  function $(id) { return document.getElementById(id); }

  function boot() {
    if (booted) return;
    booted = true;
    var canvas = $('cv');
    if (canvas && canvas.getContext) ctx = canvas.getContext('2d');
    Scav.attach(canvas);

    $('btn-start').addEventListener('click', function () { Sfx.ensure(); UI.show('brief'); Sfx.click(); });
    $('btn-howto').addEventListener('click', function () { Sfx.ensure(); UI.show('brief'); Sfx.click(); });
    $('btn-back-title').addEventListener('click', function () { UI.show('title'); Sfx.click(); });
    $('btn-go').addEventListener('click', startGame);
    $('btn-again').addEventListener('click', startGame);
    $('btn-end-title').addEventListener('click', function () { view = 'title'; UI.show('title'); Sfx.click(); });

    var sndBtn = $('btn-sound');
    function sndLabel() { sndBtn.textContent = '声音：' + (Sfx.isMuted() ? '关' : '开'); }
    sndBtn.addEventListener('click', function () {
      Sfx.setMuted(!Sfx.isMuted());
      try { localStorage.setItem('nuke60.muted', Sfx.isMuted() ? '1' : '0'); } catch (e) { }
      sndLabel();
      if (!Sfx.isMuted()) Sfx.click();
    });
    try { if (localStorage.getItem('nuke60.muted') === '1') Sfx.setMuted(true); } catch (e) { }
    sndLabel();

    /* 注意：委托必须挂在整块地堡页上 —— 消耗品的「使用」按钮在 #inv 里，
       和 #stage 是兄弟节点，只挂 #stage 会点不动。 */
    UI.bind($('screen-bunker'), onStageAction);

    window.addEventListener('keydown', function (e) {
      if (view !== 'play') return;
      if ((e.key || '').toLowerCase() === 'p') {
        var p = Scav.togglePause();
        $('pause-overlay').classList.toggle('hidden', !p);
      }
    });

    $('boom-overlay').addEventListener('click', function () {
      if (view !== 'boom') return;
      goBunker();
    });

    view = 'title';
    UI.show('title');
    if (typeof requestAnimationFrame === 'function') {
      last = 0;
      requestAnimationFrame(frame);
    }
  }

  function frame(ts) {
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
    last = ts;
    if (view === 'play') {
      Scav.update(dt);
      if (ctx) Scav.render(ctx);
      UI.hud();
    }
    requestAnimationFrame(frame);
  }

  function startGame() {
    Sfx.ensure();
    view = 'play';
    res = null;
    boomDone = false;
    if (boomTimer) { clearTimeout(boomTimer); boomTimer = null; }
    UI.hudReset();
    $('boom-overlay').classList.add('hidden');
    $('pause-overlay').classList.add('hidden');
    var seed = ((Date.now() % 900000) + 1000) | 0;
    Scav.start(seed, onScavEnd);
    UI.show('play');
    UI.hud();
  }

  function onScavEnd(r) {
    res = r;
    if (!r.success) {
      view = 'end';
      Sfx.lose();
      UI.showEnding({
        reason: 'nuke', day: 0, goal: Bunker.GOAL, alive: [], aliveCount: 0,
        deaths: [], brought: r.grabbed.length, rescued: r.family.length, seed: r.seed
      });
      return;
    }
    view = 'boom';
    boomDone = false;
    $('boom-line').textContent =
      '地面在你头顶合上。整栋房子被按进了土里，声音像是有人在你耳边关上一本厚书。';
    $('boom-overlay').classList.remove('hidden');
    boomTimer = setTimeout(goBunker, 3800);
  }

  function goBunker() {
    if (boomDone || !res) return;
    boomDone = true;
    if (boomTimer) { clearTimeout(boomTimer); boomTimer = null; }
    view = 'bunker';
    Bunker.init({ items: res.grabbed, family: res.family, tLeft: res.tLeft }, res.seed);
    $('boom-overlay').classList.add('hidden');
    UI.show('bunker');
    UI.renderBunker();
  }

  function onStageAction(act, arg) {
    if (view !== 'bunker') return;
    var S = Bunker.state();
    if (!S) return;
    Sfx.click();

    if (act === 'ration') {
      var p = (arg || '').split(':');
      var cur = S.ration[p[0]] || { food: false, water: false };
      Bunker.setRation(p[0], p[1], !cur[p[1]]);
      UI.renderBunker();
      return;
    }
    if (act === 'use') { Bunker.useItem(arg); UI.renderBunker(); return; }
    if (act === 'confirm') Bunker.confirmRation();
    else if (act === 'choose') Bunker.choose(parseInt(arg, 10) || 0);
    else if (act === 'advance') Bunker.advance();
    else if (act === 'exp') Bunker.expedition(arg);
    else if (act === 'skipexp') Bunker.skipExpedition();
    else return;

    var S2 = Bunker.state();
    if (S2.ended) { view = 'end'; UI.showEnding(S2.ending); return; }
    UI.renderBunker();
  }

  return {
    boot: boot, startGame: startGame, onStageAction: onStageAction,
    goBunker: goBunker, getView: function () { return view; },
    setView: function (v) { view = v; }
  };
})();

/* -------------------------------------------------------------------------- */
(function () {
  if (typeof window === 'undefined') return;
  window.__GAME = {
    Scav: Scav, Bunker: Bunker, House: House, Util: Util, UI: UI, Main: Main,
    ITEMS: ITEMS, FAMILY: FAMILY, EVENTS: EVENTS, Sfx: Sfx
  };
  if (!window.__NO_AUTOSTART) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { Main.boot(); });
    } else {
      Main.boot();
    }
  }
})();
