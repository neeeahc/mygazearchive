/* 메인 — 레퍼런스 damso.com 메인 (2026-10-20 측정)
   가운데 한 장을 크게, 양옆을 작게 가로로 늘어놓고, 스크롤·화살표·아이팟 클릭휠로 한 칸씩 넘긴다 */
(() => {
  const track = document.getElementById('d-track');
  if (!track) return;
  const items = [...track.children];
  const N = items.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const creditEl = document.getElementById('d-credit');
  const songEl = document.getElementById('d-song');
  const center = document.getElementById('ipod-center');
  let cur = 0;
  let lastD = items.map(() => 0);

  /* 가운데와의 거리(d)에 따른 자리 — damso: 첫 이웃 ±27.5vw, 그다음부터 23.2vw씩 */
  const offsetOf = (d) => {
    const a = Math.abs(d);
    if (a === 0) return 0;
    const narrow = innerWidth < 720;   // 폰은 가운데 사진이 커서 옆 간격도 넓힌다
    const css = getComputedStyle(document.documentElement);
    const g1 = parseFloat(css.getPropertyValue(narrow ? '--d-gap1-m' : '--d-gap1'));   // 가운데 → 첫 옆 사진 (vw)
    const g2 = parseFloat(css.getPropertyValue(narrow ? '--d-gap2-m' : '--d-gap2'));   // 옆 사진끼리 (vw)
    return Math.sign(d) * (g1 + g2 * (a - 1));
  };

  function layout(animate = true) {
    items.forEach((it, i) => {
      let d = i - cur;
      if (d > N / 2) d -= N;
      if (d < -N / 2) d += N;
      // 화면 밖에서 반대쪽으로 넘어가는 사진은 움직임 없이 옮긴다 (가로질러 날아가지 않게)
      const jump = Math.sign(d) !== Math.sign(lastD[i]) && Math.abs(d) + Math.abs(lastD[i]) > 2;
      it.style.transition = !animate || jump || reduce ? 'none' : '';
      it.style.setProperty('--x', offsetOf(d) + 'vw');
      it.classList.toggle('is-center', d === 0);
      it.classList.toggle('is-far', Math.abs(d) > 2);
      it.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      lastD[i] = d;
    });
    const it = items[cur];
    songEl.textContent = it.dataset.song;
    creditEl.textContent = it.dataset.credit;   // 지금 사진을 찍은 사람 · 사이트
    document.body.dataset.theme = it.dataset.key;   // 배경 그라데이션 색
    songEl.className = 'd-song ' + ({ 'midnight-sun': 'f-sun', 'born-this-way': 'f-born', 'say-so': 'f-say' })[it.dataset.key];
    center.href = it.querySelector('a').getAttribute('href');
    center.setAttribute('aria-label', it.dataset.name + ' 사진 보기');
    syncSong();
  }
  const go = (step) => { cur = (cur + step + N) % N; layout(); };

  /* 스크롤 — 한 번 넘기면 잠깐 쉰다 (너무 예민하지 않게) */
  let acc = 0;
  let resting = false;
  addEventListener('wheel', (e) => {
    e.preventDefault();
    if (resting) return;
    acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(acc) < 40) return;
    go(acc > 0 ? 1 : -1);
    acc = 0;
    resting = true;
    setTimeout(() => { resting = false; }, 520);
  }, { passive: false });

  /* 키보드 ← → , 손가락 밀기 */
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
  });
  let touchX = null;
  addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX = null;
  });

  /* 옆 사진을 누르면 그 사진이 가운데로 (가운데 사진은 그 사진 페이지로) */
  items.forEach((it, i) => it.querySelector('a').addEventListener('click', (e) => {
    if (i === cur) return;
    e.preventDefault();
    e.stopPropagation();
    let d = i - cur;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    go(d);
  }, true));

  /* ── 아이팟 클릭휠 ── */
  const menuBtn = document.getElementById('ipod-menu');
  const menu = document.getElementById('d-menu');
  // 메뉴 열기 — MENU에 마우스를 올리면 열리고, 휠·메뉴 영역을 벗어나면 닫힌다. 누르면 열린 채로 고정
  let pinned = false;
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open);
  };
  menuBtn.addEventListener('click', () => {
    pinned = !(pinned && document.body.classList.contains('menu-open'));
    setMenu(pinned);
  });
  menuBtn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setMenu(true); });
  document.querySelector('.ipod-wrap').addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !pinned) setMenu(false);
  });
  document.getElementById('ipod-prev').addEventListener('click', () => go(-1));
  document.getElementById('ipod-next').addEventListener('click', () => go(1));

  // 휠 테두리를 둥글게 문지르면 30°마다 한 칸 (아이팟처럼)
  const ipod = document.getElementById('ipod');
  let lastAngle = null;
  let spin = 0;
  const angleOf = (e) => {
    const r = ipod.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  ipod.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ipod-center')) return;
    lastAngle = angleOf(e);
    spin = 0;
  });
  addEventListener('pointermove', (e) => {
    if (lastAngle === null || !(e.buttons & 1)) return;
    const a = angleOf(e);
    let da = a - lastAngle;
    if (da > 180) da -= 360;
    if (da < -180) da += 360;
    lastAngle = a;
    spin += da;
    if (Math.abs(spin) >= 30) {
      ipod.dataset.spun = '1';   // 문질렀으면 손을 뗄 때 버튼 클릭으로 치지 않는다
      go(spin > 0 ? 1 : -1);
      spin = 0;
    }
  });
  addEventListener('pointerup', () => { lastAngle = null; setTimeout(() => { delete ipod.dataset.spun; }, 0); });
  ipod.addEventListener('click', (e) => { if (ipod.dataset.spun) { e.stopPropagation(); e.preventDefault(); } }, true);

  /* 아래 ▶❙❙ — 지금 사진이 속한 묶음의 노래. 누를 때만 튼다 */
  const audio = document.getElementById('d-audio');
  const playBtn = document.getElementById('ipod-play');
  let wantPlay = false;
  function syncSong() {
    const key = items[cur].dataset.key;
    const src = 'assets/audio/' + key + '.mp3';
    if (wantPlay && !audio.src.endsWith(src)) {   // 다른 묶음으로 넘어가면 그 노래로 바꾼다
      audio.src = src;
      audio.play().catch(() => {});
    }
  }
  playBtn.addEventListener('click', () => {
    if (!audio.paused) { audio.pause(); wantPlay = false; return; }
    wantPlay = true;
    const src = 'assets/audio/' + items[cur].dataset.key + '.mp3';
    if (!audio.src.endsWith(src)) audio.src = src;
    audio.play().catch(() => {});
  });
  const syncPlay = () => {
    const playing = !audio.paused;
    document.body.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-label', playing ? '노래 멈추기' : '이 묶음 노래 재생');
  };
  ['play', 'pause', 'ended'].forEach((ev) => audio.addEventListener(ev, syncPlay));

  addEventListener('resize', () => layout(false));

  /* 첫 등장 — 가운데 한 장이 먼저, 옆 사진들이 이어서 */
  layout(false);
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('is-in')));
})();
