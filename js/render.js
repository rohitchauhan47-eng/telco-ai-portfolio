// render.js: reads data/site.json and draws the whole page from it.
// You should not need to edit this file: change data/site.json for content
// and the top of css/style.css for colours, fonts and spacing.

(function () {
  const SVG = 'http://www.w3.org/2000/svg';

  // ---------- small helpers ----------
  function h(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'path') e.dataset.path = attrs[k];   // which site.json field this text comes from (used by edit mode)
      else e.setAttribute(k, attrs[k]);
    }
    children.flat().forEach(c => c != null && e.append(c));
    return e;
  }
  function s(tag, attrs, parent) {
    const e = document.createElementNS(SVG, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgText(parent, x, y, str, cls, anchor) {
    const t = s('text', { x, y, class: cls }, parent);
    if (anchor) t.setAttribute('text-anchor', anchor);
    t.textContent = str;
    return t;
  }
  // Squeeze any diagram text marked with data-fit so it never spills out of its box.
  // Runs after the diagram is on the page, because text can only be measured there.
  function fitText(root) {
    root.querySelectorAll('text[data-fit]').forEach(t => {
      const max = parseFloat(t.dataset.fit);
      if (t.getComputedTextLength() > max) { t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    });
  }
  const fit = (t, max) => { t.dataset.fit = max; return t; };
  // Split text into lines of about maxChars characters, breaking at spaces.
  function wrap(str, maxChars) {
    const words = String(str).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(w => {
      if ((line + ' ' + w).trim().length > maxChars && line) { lines.push(line); line = w; }
      else line = (line + ' ' + w).trim();
    });
    if (line) lines.push(line);
    return lines;
  }
  // Size of text inside diagrams, from --diagram-text-scale in css/style.css. Boxes grow with it.
  const K = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--diagram-text-scale')) || 1;
  const slug = str => String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // ---------- the one rule for agent links ----------
  // Empty link -> "App coming soon" (not clickable). Filled link -> opens the app in a new tab.
  function appButton(agent, D) {
    if (!agent.link) return h('span', { class: 'soon', text: D.text.comingSoon });
    return h('a', { class: 'btn primary', href: agent.link, target: '_blank', rel: 'noopener', text: D.text.openApp + ' ↗' });
  }
  // The same rule inside a diagram: adds a small "Open app" link under a box, only when a link exists.
  function svgAppLink(parent, agent, x, y, D, anchor) {
    if (!agent.link) return 0;
    const a = s('a', { href: agent.link, target: '_blank', rel: 'noopener', class: 'applink' }, parent);
    a.setAttribute('aria-label', D.text.openApp + ': ' + agent.name + ' (opens in a new tab)');
    svgText(a, x, y, D.text.openApp + ' ↗', 't-link', anchor);
    return 18 * K();
  }

  function lookups(D) {
    const agent = id => id === D.platform.human.id
      ? Object.assign({ status: '', link: '', mainTeams: ['human'], tagline: D.platform.human.note }, D.platform.human)
      : D.agents.find(a => a.id === id);
    const team = id => D.teams.find(t => t.id === id);
    const goal = id => D.goals.find(g => g.id === id);
    const teamNames = a => a.mainTeams[0] === 'shared' ? 'Shared' : a.mainTeams[0] === 'human' ? 'Human' : a.mainTeams.map(t => team(t).name).join(' · ');
    return { agent, team, goal, teamNames };
  }

  // ---------- intro, navigation, headings ----------
  function renderText(D) {
    const T = D.text;
    document.title = T.pageTitle;
    document.getElementById('site-name').textContent = T.siteName;
    document.getElementById('eyebrow').textContent = T.eyebrow;
    document.getElementById('headline').textContent = T.headline;
    document.getElementById('idea').textContent = T.idea;

    const goals = document.getElementById('goals');
    D.goals.forEach((g, i) => goals.append(h('div', { class: 'goal' },
      h('b', { 'aria-hidden': 'true', text: g.icon }), h('span', { text: g.name, path: `goals.${i}.name` }), h('small', { text: g.how, path: `goals.${i}.how` }))));

    const links = (editable) => [
      h('span', {}, D.owner.name + ' · ', h('span', editable ? { text: D.owner.tagline, path: 'owner.tagline' } : { text: D.owner.tagline })),
      h('a', { class: 'chip', href: D.owner.linkedin, target: '_blank', rel: 'noopener', text: 'LinkedIn ↗' }),
      h('a', { class: 'chip', href: D.owner.github, target: '_blank', rel: 'noopener', text: 'GitHub ↗' })
    ];
    document.getElementById('by').append(...links(true));
    document.getElementById('footer-text').textContent = T.footer;
    document.getElementById('footer-links').append(...links());

    // Sections appear in the order they are listed in site.json. "show": false hides one.
    const main = document.getElementById('main');
    D.sections.forEach(sec => {
      const el = document.getElementById(sec.id);
      if (!el) return;
      main.appendChild(el);
      if (sec.show === false) el.hidden = true;
    });
    const nav = document.getElementById('nav');
    D.sections.filter(sec => sec.show !== false).forEach((sec, i) => {
      nav.append(h('a', { href: '#' + sec.id, text: sec.nav }));
      const root = document.getElementById(sec.id);
      if (!root) return;
      root.setAttribute('aria-labelledby', sec.id + '-h');
      const k = D.sections.indexOf(sec);
      root.querySelector('[data-head]').replaceWith(
        h('div', { class: 's-head' }, h('span', { class: 'num', text: String(i + 1).padStart(2, '0') }), h('h2', { id: sec.id + '-h', text: sec.title, path: `sections.${k}.title` })),
        h('p', { class: 's-lede', text: sec.lede, path: `sections.${k}.lede` }));
      const cap = root.querySelector('[data-caption]');
      if (cap) { cap.textContent = sec.caption || ''; cap.dataset.path = `sections.${k}.caption`; }
    });
    document.getElementById('status-note').textContent = T.statusNote;
    const skills = D.sections.find(x => x.id === 'skills');
    document.getElementById('courses-title').textContent = skills ? skills.coursesTitle : '';
    if (skills) document.getElementById('courses-title').dataset.path = `sections.${D.sections.indexOf(skills)}.coursesTitle`;
    [['eyebrow', 'text.eyebrow'], ['headline', 'text.headline'], ['idea', 'text.idea'], ['footer-text', 'text.footer'],
     ['status-note', 'text.statusNote'], ['story-label', 'text.storyLabel']]
      .forEach(([id, path]) => { document.getElementById(id).dataset.path = path; });
    document.getElementById('story-label').textContent = T.storyLabel;
  }

  // ---------- agent detail panel (opened from the big picture) ----------
  function showPanel(a, D, L) {
    const p = document.getElementById('agent-panel');
    p.hidden = false;
    p.replaceChildren(
      h('h3', { text: a.name }),
      h('div', { class: 'meta' }, h('span', { text: (a.deck ? a.deck + ' · ' : '') + L.teamNames(a) }), statusTag(a.status)),
      h('p', { text: a.purpose }),
      h('p', { class: 'meta', text: a.input + '  →  ' + a.brain + '  →  ' + a.output }),
      h('p', {}, appButton(a, D), ' ', h('a', { href: '#card-' + a.id, text: 'See the full card' })));
  }
  function statusTag(status) {
    return status ? h('span', { class: 'tag s-' + slug(status), text: status }) : '';
  }

  // An agent box in a diagram: clickable (shows details) and keyboard-usable.
  function agentNode(parent, a, x, y, w, D, L, onPick, extraH) {
    const k = K();
    const nameLines = wrap(a.name, Math.floor((w - 20) / (7.6 * k)));
    const tagLines = a.tagline ? wrap(a.tagline, Math.floor((w - 20) / (6.2 * k))) : [];
    const hgt = 14 + (nameLines.length * 18 + tagLines.length * 15 + (a.status ? 24 : 4)) * k + 6 + Math.max(0, extraH || 0);
    const g = s('g', { class: 'node st-' + slug(a.status || 'none'), tabindex: 0, role: 'button', 'data-agent': a.id }, parent);
    g.setAttribute('aria-label', a.name + (a.status ? ', ' + a.status : '') + '. Show details');
    s('rect', { x, y, width: w, height: hgt, rx: 8, class: 'd-box' }, g);
    let ty = y + 8 + 14 * k;
    nameLines.forEach(l => { fit(svgText(g, x + 10, ty, l, 't-title'), w - 20); ty += 18 * k; });
    tagLines.forEach(l => { fit(svgText(g, x + 10, ty - 2 * k, l, 't-small'), w - 20); ty += 15 * k; });
    if (a.status) {
      const bw = (a.status.length * 6.6 + 12) * k;
      s('rect', { x: x + 10, y: ty - 4 * k, width: bw, height: 17 * k, rx: 3, class: 'd-badge' }, g);
      svgText(g, x + 10 + 6 * k, ty + 8 * k, a.status.toUpperCase(), 't-badge');
    }
    const pick = () => onPick(a);
    g.addEventListener('click', pick);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    const extra = svgAppLink(parent, a, x + 10, y + hgt + 15 * K(), D);
    return hgt + extra;
  }
  function arrow(parent, x1, y1, x2, y2) {
    const dir = Math.atan2(y2 - y1, x2 - x1), sz = 7;
    s('line', { x1, y1, x2: x2 - 6 * Math.cos(dir), y2: y2 - 6 * Math.sin(dir), class: 'd-flow' }, parent);
    const p = (ang) => (x2 - sz * Math.cos(dir + ang)) + ',' + (y2 - sz * Math.sin(dir + ang));
    s('polygon', { points: x2 + ',' + y2 + ' ' + p(0.5) + ' ' + p(-0.5), class: 'd-arrow' }, parent);
  }
  // Draw an arrow between two boxes: side to side when one is clearly beside the other, otherwise top to bottom.
  function connect(parent, a, b) {
    if (a.x + a.w <= b.x) return arrow(parent, a.x + a.w, a.y + a.h / 2, b.x - 2, b.y + b.h / 2);
    if (b.x + b.w <= a.x) return arrow(parent, a.x, a.y + a.h / 2, b.x + b.w + 2, b.y + b.h / 2);
    if (a.y + a.h <= b.y) return arrow(parent, a.x + a.w / 2, a.y + a.h, b.x + b.w / 2, b.y - 2);
    return arrow(parent, a.x + a.w / 2, a.y, b.x + b.w / 2, b.y + b.h + 2);
  }
  function infoBox(parent, x, y, w, hgt, title, note, dashed) {
    const r = s('rect', { x, y, width: w, height: hgt, rx: 8, class: 'd-box' }, parent);
    if (dashed) r.setAttribute('stroke-dasharray', '6 4');
    fit(svgText(parent, x + w / 2, y + hgt / 2 - 3 * K(), title, 't-title', 'middle'), w - 16);
    fit(svgText(parent, x + w / 2, y + hgt / 2 + 15 * K(), note, 't-small', 'middle'), w - 16);
  }

  // ---------- 1. big picture ----------
  function renderBigPicture(D, L) {
    const host = document.getElementById('bigpic');
    const width = host.clientWidth || 340;
    const wide = width >= 720;
    const svg = s('svg', { role: 'group', 'aria-label': 'Big picture: shared data, Master AI Agent and human approval at the top, five team columns with their agents, and four business goals at the bottom' });
    const co = D.agents.find(a => a.mainTeams[0] === 'shared');
    const pick = a => {
      svg.querySelectorAll('.node').forEach(n => n.classList.toggle('sel', n.dataset.agent === a.id));
      showPanel(a, D, L);
    };
    const W = wide ? 1080 : Math.max(300, Math.min(width, 700));
    const k = K(), ib = Math.round(58 * k), hb = Math.round(36 * k);
    let H;

    if (wide) {
      // Hand-placed nudges from edit mode ("layout" in site.json). Only used on the wide layout.
      const nudges = (D.layout && D.layout.bigPicture) || {};
      // each nudge is [move right, move down, extra width, extra height]
      const place = (key, x, y, w) => {
        const [dx = 0, dy = 0, dw = 0, dh = 0] = nudges[key] || [];
        const w2 = Math.min(Math.max(w + dw, 80), W);
        return { x: Math.min(Math.max(x + dx, 0), W - w2), y: Math.max(y + dy, 0), w: w2, dh };
      };
      const dragGroup = (parent, key) => s('g', { 'data-drag': 'bigPicture:' + key }, parent);
      const boxes = {};   // where each box ended up, for drawing the lines between them
      const lines = s('g', {}, svg);   // lines go underneath the boxes

      // top row: shared data -> Master AI Agent -> human approval
      const bw = 300, gap = (W - 3 * bw) / 4;
      let p = place('shared', gap, 0, bw), bh2 = Math.max(30, ib + p.dh);
      infoBox(dragGroup(svg, 'shared'), p.x, p.y, p.w, bh2, D.platform.sharedData.name, D.platform.sharedData.note);
      boxes.shared = { x: p.x, y: p.y, w: p.w, h: bh2 };
      let coH = ib;
      if (co) {
        p = place('co', gap * 2 + bw, 0, bw);
        coH = agentNode(dragGroup(svg, 'co'), co, p.x, p.y, p.w, D, L, pick, p.dh);
        boxes.co = { x: p.x, y: p.y, w: p.w, h: coH };
      }
      p = place('human', gap * 3 + bw * 2, 0, bw); bh2 = Math.max(30, ib + p.dh);
      infoBox(dragGroup(svg, 'human'), p.x, p.y, p.w, bh2, D.platform.human.name, D.platform.human.note);
      boxes.human = { x: p.x, y: p.y, w: p.w, h: bh2 };
      if (boxes.co) { connect(lines, boxes.shared, boxes.co); connect(lines, boxes.co, boxes.human); }

      // team columns, each with its agents
      const n = D.teams.length, cg = 14, cw = (W - (n - 1) * cg) / n;
      const top = Math.max(coH, ib) + 50;
      const cols = D.teams.map((t, i) => {
        const pc = place('team:' + t.id, i * (cw + cg), top, cw), w = pc.w;
        const g = dragGroup(svg, 'team:' + t.id);
        const bg = s('rect', { x: pc.x, y: pc.y, width: w, height: 10, rx: 10, class: 'd-tint' }, g);
        s('rect', { x: pc.x, y: pc.y, width: w, height: hb, rx: 10, class: 'd-head' }, g);
        fit(svgText(g, pc.x + w / 2, pc.y + hb / 2 + 5 * k, t.name.toUpperCase(), 't-white', 'middle'), w - 12);
        let y = hb + 10;
        D.agents.filter(a => a.mainTeams.includes(t.id)).forEach(a => {
          const key = 'agent:' + a.id + '@' + t.id;
          const [dx = 0, dy = 0, dw = 0, dh = 0] = nudges[key] || [];
          y += agentNode(dragGroup(g, key), a, pc.x + 8 + dx, pc.y + y + dy, Math.max(w - 16 + dw, 80), D, L, pick, dh) + 10;
        });
        return { bg, x: pc.x, y: pc.y, w, h: y + 4, dh: pc.dh };
      });
      // all columns the same height (plus any extra height you dragged onto one)
      const colH = Math.max(...cols.map(c => c.h));
      cols.forEach(c => { c.h = colH + Math.max(0, c.dh); c.bg.setAttribute('height', c.h); });
      const coBox = boxes.co || boxes.shared;
      cols.forEach(c => {
        const fx = coBox.x + coBox.w / 2, fy = coBox.y + coBox.h, tx = c.x + c.w / 2, mid = fy + (c.y - fy) / 2;
        s('path', { d: `M${fx},${fy} V${mid} H${tx} V${c.y}`, class: 'd-line' }, lines);
      });

      // goals row: placed under the teams that serve them, so the arrows cross as little as possible
      const colBottom = Math.max(...cols.map(c => c.y + c.h));
      const gy = colBottom + 60, gn = D.goals.length, gg = 16, gw = (W - (gn - 1) * gg) / gn;
      const servers = id => D.teams.map((t, i) => t.goals.includes(id) ? i : -1).filter(i => i >= 0);
      const avg = id => { const c = servers(id); return c.length ? c.reduce((a, b) => a + b, 0) / c.length + Math.min(...c) / 100 : 99; };
      const goalOrder = [...D.goals].sort((a, b) => avg(a.id) - avg(b.id));
      const goalBox = {};
      goalOrder.forEach((g, i) => {
        const pg = place('goal:' + g.id, i * (gw + gg), gy, gw), w = pg.w, gh = Math.max(30, ib + pg.dh);
        const grp = dragGroup(svg, 'goal:' + g.id);
        s('rect', { x: pg.x, y: pg.y, width: w, height: gh, rx: 8, class: 'd-dark' }, grp);
        fit(svgText(grp, pg.x + w / 2, pg.y + gh / 2 - 4 * k, g.icon + '  ' + g.name, 't-white', 'middle'), w - 12);
        fit(svgText(grp, pg.x + w / 2, pg.y + gh / 2 + 15 * k, g.how, 't-white-small', 'middle'), w - 12);
        goalBox[g.id] = { x: pg.x, y: pg.y, w, h: gh };
      });
      D.teams.forEach((t, i) => {
        const c = cols[i], cx = c.x + c.w / 2, cy = c.y + c.h;
        t.goals.forEach(gid => {
          const gb = goalBox[gid];
          if (!gb) return;
          const from = servers(gid), j = from.indexOf(i);
          const tx = gb.x + gb.w / 2 + (from.length > 1 ? (j - (from.length - 1) / 2) * 36 : 0), ty = gb.y;
          s('path', { d: `M${cx},${cy} C${cx},${cy + 30} ${tx},${ty - 30} ${tx},${ty - 6}`, class: 'd-flow' }, lines);
          s('polygon', { points: `${tx},${ty} ${tx - 5},${ty - 8} ${tx + 5},${ty - 8}`, class: 'd-arrow' }, lines);
        });
      });
      const goalsBottom = Math.max(...Object.values(goalBox).map(b => b.y + b.h));
      svgText(svg, 0, goalsBottom + 22 * k, 'BUSINESS GOALS FOR THE TELCO', 't-label');
      H = goalsBottom + 30 * k;
      svg.dataset.free = '1';
    } else {
      // phone: everything stacked in one column
      let y = 0;
      infoBox(svg, 0, y, W, ib, D.platform.sharedData.name, D.platform.sharedData.note); y += ib;
      arrow(svg, W / 2, y + 2, W / 2, y + 20); y += 22;
      if (co) { y += agentNode(svg, co, 0, y, W, D, L, pick); }
      arrow(svg, W / 2, y + 2, W / 2, y + 20); y += 22;
      infoBox(svg, 0, y, W, ib, D.platform.human.name, D.platform.human.note); y += ib + 20;
      D.teams.forEach(t => {
        const start = y;
        const bg = s('rect', { x: 0, y: start, width: W, height: 10, rx: 10, class: 'd-tint' }, svg);
        s('rect', { x: 0, y: start, width: W, height: hb, rx: 10, class: 'd-head' }, svg);
        fit(svgText(svg, 12, start + hb / 2 + 5 * k, t.name.toUpperCase(), 't-white'), W - 24);
        y += hb + 10;
        D.agents.filter(a => a.mainTeams.includes(t.id)).forEach(a => { y += agentNode(svg, a, 8, y, W - 16, D, L, pick) + 8; });
        fit(svgText(svg, 12, y + 12 * k, '→ ' + t.goals.map(g => L.goal(g).name).join(' · ').toUpperCase(), 't-label'), W - 24);
        y += 22 * k;
        bg.setAttribute('height', y - start);
        y += 14;
      });
      H = y;
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    host.replaceChildren(svg);
    fitText(svg);
  }

  // ---------- 2. which agent helps which team ----------
  function renderGrid(D) {
    const head = h('tr', {}, h('th', { scope: 'col', text: 'Agent' }),
      D.teams.map(t => h('th', { scope: 'col' }, h('span', { class: 'full', text: t.name }), h('span', { class: 'short', text: t.short || t.name, 'aria-hidden': 'true' }))));
    const rows = D.agents.map(a => {
      const label = a.link
        ? h('a', { href: a.link, target: '_blank', rel: 'noopener', text: a.name + ' ↗' })
        : document.createTextNode(a.name);
      return h('tr', {}, h('th', { scope: 'row' }, label),
        D.teams.map(t => {
          const main = a.mainTeams.includes(t.id), also = (a.alsoHelps || []).includes(t.id);
          return h('td', { 'aria-label': main ? 'main team' : also ? 'also helps' : 'no' , text: main ? '●' : also ? '○' : '' });
        }));
    });
    document.getElementById('grid').replaceChildren(
      h('div', { class: 'grid-wrap' }, h('table', { class: 'grid' }, h('thead', {}, head), h('tbody', {}, rows))));
  }

  // ---------- 4. agent cards, grouped by main team ----------
  function ioDiagram(a) {
    const W = 300, bw = 84, gap = (W - 3 * bw) / 2;
    const parts = [['INPUT', a.input], ['BRAIN', a.brain], ['OUTPUT', a.output]];
    const k = K();
    const lines = parts.map(p => wrap(p[1], Math.floor(12 / k)));
    const H = (30 + Math.max(...lines.map(l => l.length)) * 16) * k + 10;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'io' });
    svg.setAttribute('aria-label', `Input: ${a.input}. Brain: ${a.brain}. Output: ${a.output}.`);
    parts.forEach((p, i) => {
      const x = i * (bw + gap);
      s('rect', { x: x + 1, y: 1, width: bw - 2, height: H - 2, rx: 6, class: i === 1 ? 'd-tint' : 'd-box' }, svg);
      svgText(svg, x + 8, 17 * k, p[0], 't-label');
      lines[i].forEach((l, n) => fit(svgText(svg, x + 8, (34 + n * 16) * k, l, 't-small'), bw - 14));
      if (i < 2) arrow(svg, x + bw + 4, H / 2, x + bw + gap - 4, H / 2);
    });
    return svg;
  }
  function renderCards(D, L) {
    const order = a => a.mainTeams[0] === 'shared' ? -1 : D.teams.findIndex(t => t.id === a.mainTeams[0]);
    const groups = new Map();
    [...D.agents].sort((x, y) => order(x) - order(y)).forEach(a => {
      const key = a.mainTeams.join('+');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    });
    const out = [];
    groups.forEach((agents, key) => {
      const teamIds = key.split('+');
      const shared = teamIds[0] === 'shared';
      const goals = shared ? D.goals.map(g => g.id)
        : [...new Set(teamIds.flatMap(id => L.team(id).goals))];
      out.push(h('div', { class: 'group' },
        h('h3', { class: 'group-head' },
          h('span', { text: shared ? 'Master AI Agent · controls and connects all agents' : teamIds.map(id => L.team(id).name).join(' · ') }),
          h('span', { text: goals.map(g => L.goal(g).name).join(' · ') })),
        h('div', { class: 'cards' }, agents.map(a => h('article', { class: agents.length === 1 ? 'card solo' : 'card', id: 'card-' + a.id },
          h('div', { class: 'card-top' }, h('div', {}, a.deck ? h('p', { class: 'deck', text: a.deck, path: `agents.${D.agents.indexOf(a)}.deck` }) : '', h('h3', { text: a.name, path: `agents.${D.agents.indexOf(a)}.name` })), statusTag(a.status)),
          h('p', { text: a.purpose, path: `agents.${D.agents.indexOf(a)}.purpose` }),
          ioDiagram(a),
          h('div', { class: 'action' }, appButton(a, D)))))));
    });
    document.getElementById('agent-groups').replaceChildren(...out);
    fitText(document.getElementById('agent-groups'));
  }

  // ---------- 5. skills and courses ----------
  function renderSkills(D, L) {
    const usedIn = list => {
      if (!list || !list.length) return '';
      return 'Used in: ' + list.map(id => id === 'all' ? 'all agents' : (L.agent(id) ? L.agent(id).short || L.agent(id).name : id)).join(', ');
    };
    document.getElementById('skill-groups').replaceChildren(h('div', { class: 'skill-groups' },
      D.skills.map((g, gi) => h('div', { class: 'skill-group' },
        h('h3', { text: g.group, path: `skills.${gi}.group` }),
        h('ul', { class: 'chips' }, g.items.map((k, ki) => h('li', { class: 'skill' },
          h('b', {}, h('span', { text: k.name, path: `skills.${gi}.items.${ki}.name` }), h('span', { class: 'tag k-' + slug(k.status), text: k.status })),
          h('small', { text: usedIn(k.usedIn) }))))))));
    document.getElementById('courses').replaceChildren(...D.courses.map((c, i) => h('li', { text: c, path: `courses.${i}` })));
  }

  // ---------- start ----------
  async function start() {
    let D;
    try {
      const inline = document.getElementById('site-data');   // the preview copy carries its data inside the page
      D = inline ? JSON.parse(inline.textContent) : await (await fetch('data/site.json', { cache: 'no-cache' })).json();
    } catch (err) {
      const msg = location.protocol === 'file:'
        ? 'The page cannot read data/site.json when opened by double-click. In a terminal in this folder run  py -m http.server 8000  and open http://localhost:8000'
        : 'data/site.json could not be read. It may have a typing mistake (a missing comma or quote). Details: ' + err.message;
      document.getElementById('main').prepend(h('div', { class: 'wrap' }, h('p', { class: 'error', text: msg })));
      console.error(err);
      return;
    }
    const L = lookups(D);
    renderText(D);
    renderBigPicture(D, L);
    renderGrid(D);
    renderCards(D, L);
    renderSkills(D, L);
    // Redraw the diagrams and cards (used after a resize or a size change in edit mode).
    const redrawDiagrams = () => { renderBigPicture(D, L); document.dispatchEvent(new Event('portfolio:resize')); };
    const redraw = () => { renderCards(D, L); redrawDiagrams(); };
    window.Portfolio = { data: D, lookups: L, h, s, svgText, wrap, slug, arrow, connect, svgAppLink, K, redraw, redrawDiagrams, fit, fitText };
    // Announce after the other scripts have loaded (in the one-file preview the data is ready at once).
    setTimeout(() => document.dispatchEvent(new Event('portfolio:ready')));

    // Edit mode (only when the address ends in ?edit): load the editor.
    if (new URLSearchParams(location.search).has('edit')) {
      const ed = document.createElement('script');
      ed.src = 'js/editor.js';
      document.body.appendChild(ed);
    }

    let lastWide = null;
    addEventListener('resize', () => {
      const wide = document.getElementById('bigpic').clientWidth >= 720;
      if (wide !== lastWide || !wide) { lastWide = wide; renderBigPicture(D, L); document.dispatchEvent(new Event('portfolio:resize')); }
    });
  }
  start();
})();
