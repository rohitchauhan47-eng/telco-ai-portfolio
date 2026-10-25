// player.js: the one-customer story (Play / Back / Next), drawn from the "story" list in data/site.json.

document.addEventListener('portfolio:ready', function () {
  const P = window.Portfolio, D = P.data, L = P.lookups;
  const steps = D.story;
  const host = document.getElementById('story-chain');
  let current = 0, timer = null, nodes = [];

  function draw() {
    const width = host.clientWidth || 340;
    const wide = width >= 720;
    const cols = wide ? steps.length : 2;
    const W = wide ? 1080 : Math.max(300, Math.min(width, 700));
    const k = P.K(), gap = wide ? 28 : 22, bw = (W - (cols - 1) * gap) / cols, bh = 64 * k;
    const svg = P.s('svg', { role: 'group', 'aria-label': 'Story steps' });
    nodes = [];
    let maxY = 0;
    const nudges = (wide && D.layout && D.layout.story) || {};   // hand-placed nudges from edit mode
    const links = P.s('g', {}, svg), placed = [];
    steps.forEach((st, i) => {
      const a = L.agent(st.agent);
      const col = i % cols, row = Math.floor(i / cols);
      const [dx = 0, dy = 0, dw = 0, dh = 0] = nudges['step:' + i] || [];   // move right, move down, extra width, extra height
      const w = Math.min(Math.max(bw + dw, 70), W), hh = Math.max(bh + dh, 30 * k);
      const x = Math.min(Math.max(col * (bw + gap) + dx, 0), W - w), y = Math.max(row * (bh + 46 * k) + 16 * k + dy, 16 * k);
      const box = P.s('g', { 'data-drag': 'story:step:' + i }, svg);
      const team = a.mainTeams[0] === 'shared' ? 'Shared' : a.mainTeams[0] === 'human' ? 'Human'
        : a.mainTeams.map(id => { const t = L.team(id); return wide ? t.name : (t.short || t.name); }).join(' · ');
      P.fit(P.svgText(box, x + w / 2, y - 6 * k, team.toUpperCase(), 't-label', 'middle'), w);
      const g = P.s('g', { class: 'node', tabindex: 0, role: 'button' }, box);
      g.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + st.title);
      P.s('rect', { x, y, width: w, height: hh, rx: 8, class: 'd-box' }, g);
      const label = (i + 1) + '  ' + (st.box || a.name);   // "box" in a story step overrides the name shown
      const lines = P.wrap(label, Math.floor((w - 12) / (7.4 * k))).slice(0, 3);
      lines.forEach((l, n) => P.fit(P.svgText(g, x + w / 2, y + hh / 2 + (n - (lines.length - 1) / 2) * 18 * k + 5 * k, l, 't-title', 'middle'), w - 12));
      g.addEventListener('click', () => { stop(); show(i); });
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stop(); show(i); } });
      placed.push({ x, y, w, h: hh, col });
      if (i > 0 && (wide || col > 0)) P.connect(links, placed[i - 1], placed[i]);
      const extra = P.svgAppLink(box, a, x + w / 2, y + hh + 16 * k, D, 'middle');
      nodes.push(g);
      maxY = Math.max(maxY, y + hh + 6 + extra);
    });
    svg.setAttribute('viewBox', `0 0 ${W} ${maxY}`);
    if (wide) svg.dataset.free = '1';
    host.replaceChildren(svg);
    P.fitText(svg);
    show(current);
  }

  function show(i) {
    current = i;
    const st = steps[i];
    document.getElementById('step-no').textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
    const title = document.getElementById('step-title'), text = document.getElementById('step-text');
    title.textContent = st.title; title.dataset.path = `story.${i}.title`;
    text.textContent = st.text; text.dataset.path = `story.${i}.text`;
    nodes.forEach((n, j) => { n.classList.toggle('on', j === i); n.classList.toggle('dim', j > i); });
    document.getElementById('back').disabled = i === 0;
    document.getElementById('next').disabled = i === steps.length - 1;
  }
  const playBtn = document.getElementById('play');
  function stop() { clearInterval(timer); timer = null; playBtn.textContent = '▶ Play the story'; }
  playBtn.addEventListener('click', () => {
    if (timer) return stop();
    if (current === steps.length - 1) show(0);
    playBtn.textContent = '❚❚ Pause';
    timer = setInterval(() => { if (current >= steps.length - 1) stop(); else show(current + 1); }, 3500);
  });
  document.getElementById('back').addEventListener('click', () => { stop(); show(Math.max(0, current - 1)); });
  document.getElementById('next').addEventListener('click', () => { stop(); show(Math.min(steps.length - 1, current + 1)); });

  draw();
  document.addEventListener('portfolio:resize', draw);
});
