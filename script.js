(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  /* 시계 — 레퍼런스 상단 오른쪽 (모든 페이지) */
  const clock = document.getElementById('clock');
  if (clock) {
    const tick = () => { clock.textContent = new Date().toLocaleTimeString('ko-KR'); };
    tick();
    setInterval(tick, 1000);
  }

  /* 상단 바 글자 — 바로 아래 사진이 어두우면 그 글자만 흰색으로.
     사진마다 미리 재 둔 10×10 밝기 격자(data-lum)에서 글자 아래 칸을 읽는다 */
  const lumAt = (x, y) => {
    const img = document.elementsFromPoint(x, y).find((el) => el.tagName === 'IMG' && el.dataset.lum);
    if (!img) return 1;
    const r = img.getBoundingClientRect();
    let u = (x - r.left) / r.width;
    let v = (y - r.top) / r.height;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (getComputedStyle(img).objectFit === 'cover' && nw && nh) {   // 잘려 보이는 사진은 잘린 만큼 보정
      const s = Math.max(r.width / nw, r.height / nh);
      u = (x - r.left + (nw * s - r.width) / 2) / (nw * s);
      v = (y - r.top + (nh * s - r.height) / 2) / (nh * s);
    }
    const cx = Math.min(9, Math.max(0, Math.floor(u * 10)));
    const cy = Math.min(9, Math.max(0, Math.floor(v * 10)));
    return parseInt(img.dataset.lum[cy * 10 + cx], 16) / 15;
  };
  // 바 전체 폭에서 12곳을 재서 평균 — 어두우면 네 글자가 다 같이 흰색으로
  const bar = document.querySelector('.bar');
  const checkBar = () => {
    if (!bar) return;   // 홈처럼 상단 바가 없는 페이지
    const r = bar.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const N = 12;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += lumAt(r.left + (r.width * (i + 0.5)) / N, y);
    bar.classList.toggle('on-dark', sum / N < 0.45);
  };
  let barQueued = false;
  const queueBar = () => { if (!barQueued) { barQueued = true; requestAnimationFrame(() => { barQueued = false; checkBar(); }); } };
  addEventListener('scroll', queueBar, { passive: true });
  addEventListener('resize', queueBar);
  addEventListener('load', queueBar);
  setInterval(queueBar, 300);   // 첫 화면 링처럼 저절로 움직이는 사진도 따라가게

  /* ── 페이지 전환 — 레퍼런스처럼 들어올 때 올라오며 나타나고, 나갈 때 흐려지며 사라진다 ── */
  requestAnimationFrame(() => root.classList.add('is-ready'));
  addEventListener('pageshow', (e) => { if (e.persisted) root.classList.remove('is-leaving'); });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
    const url = new URL(a.href, location.href);
    const samePage = url.pathname === location.pathname;
    if (url.origin !== location.origin || samePage) return;
    e.preventDefault();
    root.classList.add('is-leaving');
    setTimeout(() => { location.href = a.href; }, 380);
  });

  /* 큰 문단 — 레퍼런스 Info·Case처럼 단어가 차례로 떠오른다 */
  document.querySelectorAll('.split').forEach((p, pi) => {
    let n = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.style.setProperty('--i', n++ + pi * 6);
            w.textContent = part;
            frag.append(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(p);
  });

  /* 사진 — 화면에 들어올 때 부드럽게 나타난다 */
  const toReveal = document.querySelectorAll('.item, .case-hero, .case-pair');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    toReveal.forEach((el, i) => { el.style.setProperty('--d', (i % 6) * 70 + 'ms'); io.observe(el); });
  } else {
    toReveal.forEach((el) => el.classList.add('is-in'));
  }

  /* 설명 높이를 재서 끝의 빈 공간 높이에 쓴다 (창 크기가 바뀌면 다시) */
  const stack = document.querySelector('.case-stack');
  if (stack) {
    const intro = stack.querySelector('.case-intro');
    const setIntroH = () => root.style.setProperty('--intro-h', intro.offsetHeight + 'px');
    setIntroH();
    addEventListener('resize', setIntroH);
    if (document.fonts) document.fonts.ready.then(setIntroH);
  }

  /* Next Photo — 영역 안에서 작은 다음 사진이 마우스를 부드럽게 따라다닌다 (영역 밖은 잘려 안 보임) */
  const next = document.querySelector('.case-next');
  const thumb = next && next.querySelector('.case-next-thumb');
  if (thumb) {
    const tgt = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let running = false;
    const place = () => {
      pos.x += (tgt.x - pos.x) * (reduce ? 1 : 0.18);
      pos.y += (tgt.y - pos.y) * (reduce ? 1 : 0.18);
      thumb.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
      if (Math.abs(tgt.x - pos.x) + Math.abs(tgt.y - pos.y) > 0.3) requestAnimationFrame(place);
      else running = false;
    };
    const aim = (e, jump) => {
      const r = next.getBoundingClientRect();
      tgt.x = e.clientX - r.left;
      tgt.y = e.clientY - r.top;
      if (jump) { pos.x = tgt.x; pos.y = tgt.y; }   // 들어온 자리에서 바로 나타나게
      if (!running) { running = true; requestAnimationFrame(place); }
    };
    next.addEventListener('pointerenter', (e) => aim(e, true));
    next.addEventListener('pointermove', (e) => aim(e, false));
  }

  /* ── 3D 링 — 홈에만. 스크롤은 천천히, 마우스는 부드럽게 따라 기운다 ── */
  const ring = document.getElementById('ring');
  if (ring) {
    const section = document.querySelector('.ring-section');
    const cards = [...ring.children];
    const step = 360 / cards.length;
    const SCROLL_TURN = 360;   // 끝까지 내리면 한 바퀴 — 섹션을 길게(--h-ring) 해서 도는 속도는 전과 비슷하게
    let idle = 0;
    let spin = 0;              // 스크롤 회전을 늦게 따라가는 현재값
    const target = { x: 0, y: 0 };
    const now = { x: 0, y: 0 };

    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      target.x = (e.clientX / innerWidth) * 2 - 1;
      target.y = (e.clientY / innerHeight) * 2 - 1;
    });
    root.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });

    const frame = () => {
      // 원 대신 가로로 긴 타원 위에 놓는다 — 가로 반지름 wide, 깊이 반지름 deep
      const wide = Math.min(innerWidth * 0.44, 980);
      const deep = wide * 0.5;
      const total = section.offsetHeight - innerHeight;
      const progress = Math.min(Math.max(-section.getBoundingClientRect().top / total, 0), 1);
      const k = reduce ? 1 : 0.035;
      spin += (progress * SCROLL_TURN - spin) * k;
      now.x += (target.x - now.x) * k;
      now.y += (target.y - now.y) * k;
      if (!reduce) idle += 0.015;
      const tiltX = now.y * -10;
      const tiltZ = now.x * 3;
      const turn = spin + idle + now.x * 16;
      ring.style.transform = `translateZ(${-deep}px) rotateX(${tiltX}deg) rotateZ(${tiltZ}deg)`;
      cards.forEach((c, i) => {
        const a = ((i * step - turn) * Math.PI) / 180;
        const x = Math.sin(a) * wide;
        const z = Math.cos(a) * deep;
        // 타원의 접선 방향을 바라보게 돌린다
        const face = (Math.atan2(Math.sin(a) * deep, Math.cos(a) * wide) * 180) / Math.PI;
        c.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${face}deg)`;
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ── Archive 필터 — 노래 이름을 누르면 그 묶음만 남긴다. #midnight-sun 같은 주소로도 고른다 ── */
  const items = [...document.querySelectorAll('.archive-grid .item')];
  const filters = [...document.querySelectorAll('.filter')];
  const grid = document.querySelector('.archive-grid');
  const desc = document.getElementById('filter-desc');

  function applyFilter(key) {
    const btn = filters.find((b) => b.dataset.filter === key) || filters[0];
    const all = btn.dataset.filter === 'all';
    filters.forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-pressed', b === btn);
    });
    grid.classList.toggle('is-filtered', !all);
    items.forEach((it) => {
      it.hidden = !all && it.dataset.cat !== btn.dataset.filter;
      if (!it.hidden) { it.classList.remove('is-in'); requestAnimationFrame(() => it.classList.add('is-in')); }
    });
    if (desc) desc.textContent = btn.dataset.desc;
  }
  /* ── 노래 — 레퍼런스 영상 플레이어처럼: 아래 재생바(일시정지·소리·사진 띠) + 마우스를 따라오는 play ! / pause ── */
  const player = document.getElementById('player');
  const audio = document.getElementById('player-audio');
  const playBtn = document.getElementById('player-btn');
  const muteBtn = document.getElementById('player-mute');
  const track = document.getElementById('player-track');
  const thumbs = document.getElementById('player-thumbs');
  const played = document.getElementById('player-played');
  const head = document.getElementById('player-head');
  const pill = document.getElementById('cursor-pill');
  let current = null;          // 지금 곡 { key, src, label, thumbs, btn }
  const STORE = 'mga-song';     // 페이지를 넘겨도 곡·위치·멈춤 상태를 이어 가기 위한 기록
  const readStore = () => { try { return JSON.parse(sessionStorage.getItem(STORE)) || {}; } catch (e) { return {}; } };
  const saveStore = () => {
    if (!audio || !current) return;
    try { sessionStorage.setItem(STORE, JSON.stringify({ src: audio.src, t: audio.currentTime, paused: audio.paused && userPaused })); } catch (e) {}
  };

  const syncPlayer = () => {
    const playing = !audio.paused;
    player.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-label', playing ? '일시정지' : '재생');
    pill.textContent = playing ? 'pause' : 'play !';
    filters.forEach((b) => b.classList.toggle('is-playing', playing && current && b === current.btn));
  };
  const syncMute = () => {
    player.classList.toggle('is-muted', audio.muted);
    muteBtn.setAttribute('aria-label', audio.muted ? '소리 켜기' : '소리 끄기');
  };
  // 재생 위치 → 띠 위의 세로선
  const drawTime = () => {
    const p = audio.duration ? audio.currentTime / audio.duration : 0;
    played.style.width = p * 100 + '%';
    head.style.left = p * 100 + '%';
    track.setAttribute('aria-valuenow', Math.round(p * 100));
  };
  // Archive의 노래 이름 버튼 → 곡 정보 (재생바 띠 = 그 묶음의 사진 5장)
  const songFromBtn = (btn) => ({
    key: btn.dataset.filter, src: btn.dataset.song, btn,
    label: btn.firstChild.textContent + ' — ' + btn.dataset.artist,
    thumbs: items.filter((it) => it.dataset.cat === btn.dataset.filter).map((it) => it.querySelector('img').getAttribute('src')),
  });

  function playSong(song) {
    if (!audio || !song || !song.src) return;
    if (!current || current.key !== song.key) {
      current = song;
      audio.src = song.src;
      thumbs.innerHTML = song.thumbs.map((s) => `<img src="${s}" alt="">`).join('');
      track.setAttribute('aria-valuetext', song.label);
      // 앞 페이지에서 같은 곡을 듣고 있었으면 그 위치부터, 직접 멈췄었으면 멈춘 채로
      const saved = readStore();
      if (saved.src === audio.src) {
        audio.addEventListener('loadedmetadata', () => { if (saved.t < audio.duration) audio.currentTime = saved.t; drawTime(); }, { once: true });
        if (saved.paused) userPaused = true;
      } else {
        userPaused = false;
      }
    } else {
      current.btn = song.btn || current.btn;
    }
    player.hidden = false;
    document.body.classList.add('has-song');
    requestAnimationFrame(() => player.classList.add('is-shown'));
    if (userPaused) { syncPlayer(); return; }
    audio.play().catch(waitForGesture);
  }
  /* 기본은 재생 상태. 브라우저가 소리 자동재생을 막으면 첫 클릭·키 입력 때 바로 튼다 */
  let userPaused = false;
  let unlockedNow = false;   // 방금 첫 입력으로 재생을 시작했으면, 같은 클릭이 다시 멈추지 않게
  function waitForGesture() {
    syncPlayer();
    const unlock = () => {
      removeEventListener('pointerdown', unlock, true);
      removeEventListener('keydown', unlock, true);
      if (userPaused || !audio.paused) return;
      unlockedNow = true;
      setTimeout(() => { unlockedNow = false; }, 400);
      audio.play().catch(() => {});
    };
    addEventListener('pointerdown', unlock, true);
    addEventListener('keydown', unlock, true);
  }
  // All 상태 — 재생바와 따라다니는 버튼을 숨기고 곡을 멈춘다
  function hidePlayer() {
    if (!audio) return;
    audio.pause();
    player.classList.remove('is-shown');
    player.hidden = true;
    document.body.classList.remove('has-song');
    pill.classList.remove('is-on');
  }
  const toggle = () => {
    if (unlockedNow) return;
    if (audio.paused) { userPaused = false; audio.play(); } else { userPaused = true; audio.pause(); }
    saveStore();
  };

  if (audio) {
    ['play', 'pause', 'ended'].forEach((ev) => audio.addEventListener(ev, syncPlayer));
    audio.addEventListener('timeupdate', drawTime);
    audio.addEventListener('timeupdate', saveStore);
    ['play', 'pause'].forEach((ev) => audio.addEventListener(ev, saveStore));
    addEventListener('pagehide', saveStore);
    audio.addEventListener('loadedmetadata', drawTime);
    playBtn.addEventListener('click', toggle);
    muteBtn.addEventListener('click', () => { audio.muted = !audio.muted; syncMute(); });

    // 띠를 누르거나 끌면 그 위치로 넘어간다
    const seek = (e) => {
      const r = track.getBoundingClientRect();
      const p = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      if (audio.duration) audio.currentTime = p * audio.duration;
      drawTime();
    };
    track.addEventListener('pointerdown', (e) => {
      track.setPointerCapture(e.pointerId);
      track.classList.add('is-dragging');
      seek(e);
    });
    track.addEventListener('pointermove', (e) => { if (track.hasPointerCapture(e.pointerId)) seek(e); });
    track.addEventListener('pointerup', () => track.classList.remove('is-dragging'));
    track.addEventListener('keydown', (e) => {
      if (!audio.duration) return;
      if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
      if (e.key === 'ArrowLeft') audio.currentTime = Math.max(audio.currentTime - 5, 0);
      if (e.key === ' ') { e.preventDefault(); toggle(); }
    });

    // 마우스를 따라오는 알약 — 사진·버튼·링크가 아닌 빈 곳에서만 보이고, 누르면 멈춤/재생
    const pos = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    // 알약을 숨길 곳 — 버튼·메뉴·재생바·푸터·일반 링크. 사진(.item-link) 위에서는 보인다
    const hidePillOn = (el) => el.closest('button, .player, .bar, input, .foot, a:not(.item-link)');
    // 눌러도 멈춤/재생하지 않을 곳 — 링크(사진 포함)는 원래대로 그 페이지로 간다
    const noToggleOn = (el) => el.closest('a, button, .player, .bar, input');
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      pos.x = e.clientX; pos.y = e.clientY;
      pill.classList.toggle('is-on', !player.hidden && !hidePillOn(e.target));
    });
    root.addEventListener('pointerleave', () => pill.classList.remove('is-on'));
    document.addEventListener('click', (e) => {
      if (player.hidden || noToggleOn(e.target) || !pill.classList.contains('is-on')) return;
      toggle();
      pill.classList.remove('is-pop'); void pill.offsetWidth; pill.classList.add('is-pop');
    });
    const follow = () => {
      const k = reduce ? 1 : 0.2;
      cur.x += (pos.x - cur.x) * k;
      cur.y += (pos.y - cur.y) * k;
      pill.style.transform = `translate(${cur.x}px, ${cur.y}px) translate(-50%, -50%)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }

  // 사진 페이지 — 재생바에 적어 둔 그 묶음의 곡을 튼다
  if (player && player.dataset.song && !filters.length) {
    playSong({
      key: player.dataset.key, src: player.dataset.song, label: player.dataset.label,
      thumbs: [...thumbs.querySelectorAll('img')].map((i) => i.getAttribute('src')),
    });
  }

  if (filters.length && grid) {
    filters.forEach((b) => b.addEventListener('click', () => {
      applyFilter(b.dataset.filter);
      if (b.dataset.song) playSong(songFromBtn(b)); else hidePlayer();
      history.replaceState(null, '', b.dataset.filter === 'all' ? location.pathname : '#' + b.dataset.filter);
    }));
    if (location.hash) applyFilter(location.hash.slice(1));
    // 주소에 묶음이 있으면(#say-so 등) 들어오자마자 그 곡 재생. All로 들어오면 음악 없음
    const first = filters.find((b) => b.dataset.filter === location.hash.slice(1) && b.dataset.song);
    if (first && audio) playSong(songFromBtn(first));
    addEventListener('hashchange', () => {
      const key = location.hash.slice(1) || 'all';
      applyFilter(key);
      const b = filters.find((f) => f.dataset.filter === key && f.dataset.song);
      if (b) playSong(songFromBtn(b)); else hidePlayer();
    });
  }
})();
