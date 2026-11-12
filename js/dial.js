/*
 * 남은 시간 테두리 눈금.
 * 모서리가 둥근 사각형을 따라 눈금을 그리고, 남은 비율만큼
 * 위쪽 가운데부터 시계 방향으로 눈금을 밝게 표시한다.
 * 지나간 시간의 눈금은 경계에서 멀어질수록 옅어진다.
 */
const Dial = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TICK_LEN = 12; // 눈금 길이(px)
  const TICK_GAP = 11; // 눈금 간격(px, 테두리 둘레 기준)
  const EDGE = 4; // 상자 가장자리와 눈금 사이 여백
  const RADIUS = 26; // 모서리 둥글기 (눈금 중심선 기준)

  const OFF_NEAR = 0.5; // 꺼진 눈금 중 경계 바로 옆의 진하기
  const OFF_FAR = 0.12; // 꺼진 눈금 중 가장 먼 쪽의 진하기
  const OFF_EMPTY = 0.25; // 시간이 입력되지 않았을 때

  let container = null;
  let svg = null;
  let ticks = []; // { line, on, opacity }
  let builtW = 0;
  let builtH = 0;
  let current = { fraction: 1, state: 'normal' };

  function init(el) {
    container = el;
    container.dataset.state = current.state;
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'dial-ticks');
    svg.setAttribute('aria-hidden', 'true');
    container.prepend(svg);
    build();
    if ('ResizeObserver' in window) new ResizeObserver(build).observe(container);
    else window.addEventListener('resize', build);
  }

  /** 둥근 사각형 둘레를 위쪽 가운데부터 시계 방향으로 나눈 구간들 */
  function makeSegments(x0, y0, w, h, r) {
    const R = x0 + w;
    const B = y0 + h;
    const cx = x0 + w / 2;
    const line = (ax, ay, bx, by, nx, ny) => ({
      len: Math.hypot(bx - ax, by - ay),
      at: (t) => ({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx, ny }),
    });
    const arc = (ccx, ccy, startAngle) => ({
      len: (Math.PI * r) / 2,
      at: (t) => {
        const a = startAngle + (t * Math.PI) / 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        return { x: ccx + r * c, y: ccy + r * s, nx: c, ny: s };
      },
    });
    return [
      line(cx, y0, R - r, y0, 0, -1), // 위 (가운데 → 오른쪽)
      arc(R - r, y0 + r, -Math.PI / 2), // 오른쪽 위 모서리
      line(R, y0 + r, R, B - r, 1, 0), // 오른쪽
      arc(R - r, B - r, 0), // 오른쪽 아래 모서리
      line(R - r, B, x0 + r, B, 0, 1), // 아래
      arc(x0 + r, B - r, Math.PI / 2), // 왼쪽 아래 모서리
      line(x0, B - r, x0, y0 + r, -1, 0), // 왼쪽
      arc(x0 + r, y0 + r, Math.PI), // 왼쪽 위 모서리
      line(x0 + r, y0, cx, y0, 0, -1), // 위 (왼쪽 → 가운데)
    ].filter((seg) => seg.len > 0);
  }

  function pointAt(segments, distance) {
    let d = distance;
    for (const seg of segments) {
      if (d <= seg.len) return seg.at(seg.len ? d / seg.len : 0);
      d -= seg.len;
    }
    const last = segments[segments.length - 1];
    return last.at(1);
  }

  /**
   * 켜진 눈금에 쓰는 그라데이션 (Liquid Glass: 보라 → 민트 / 산호 → 살구).
   * CSS에서 stroke: url(#dialGradNormal) 로 참조한다.
   */
  function makeGradients(w, h) {
    const defs = document.createElementNS(SVG_NS, 'defs');
    const make = (id, stops) => {
      const g = document.createElementNS(SVG_NS, 'linearGradient');
      g.setAttribute('id', id);
      g.setAttribute('gradientUnits', 'userSpaceOnUse');
      g.setAttribute('x1', '0');
      g.setAttribute('y1', '0');
      g.setAttribute('x2', String(w));
      g.setAttribute('y2', String(h));
      stops.forEach(([offset, cls]) => {
        const stop = document.createElementNS(SVG_NS, 'stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('class', cls);
        g.appendChild(stop);
      });
      defs.appendChild(g);
    };
    make('dialGradNormal', [['0%', 'stop-accent-2'], ['55%', 'stop-accent'], ['100%', 'stop-mint']]);
    make('dialGradAlert', [['0%', 'stop-alert-2'], ['100%', 'stop-alert']]);
    return defs;
  }

  /** 상자 크기에 맞춰 눈금을 다시 만든다 (창 크기 변경 시) */
  function build() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h || (w === builtW && h === builtH)) return;
    builtW = w;
    builtH = h;

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    const inset = EDGE + TICK_LEN / 2;
    const rw = w - inset * 2;
    const rh = h - inset * 2;
    const r = Math.min(RADIUS, rw / 2, rh / 2);
    const segments = makeSegments(inset, inset, rw, rh, r);
    const perimeter = segments.reduce((sum, seg) => sum + seg.len, 0);
    const count = Math.max(24, Math.round(perimeter / TICK_GAP));

    svg.textContent = '';
    svg.appendChild(makeGradients(w, h));
    ticks = [];
    const half = TICK_LEN / 2;
    for (let i = 0; i < count; i++) {
      const p = pointAt(segments, (perimeter * i) / count);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', (p.x - p.nx * half).toFixed(2));
      line.setAttribute('y1', (p.y - p.ny * half).toFixed(2));
      line.setAttribute('x2', (p.x + p.nx * half).toFixed(2));
      line.setAttribute('y2', (p.y + p.ny * half).toFixed(2));
      svg.appendChild(line);
      ticks.push({ line, on: null, opacity: null });
    }
    paint();
  }

  function setTick(tick, on, opacity) {
    if (tick.on !== on) {
      tick.line.classList.toggle('on', on);
      tick.on = on;
    }
    const op = Math.round(opacity * 100) / 100;
    if (tick.opacity !== op) {
      tick.line.style.opacity = String(op);
      tick.opacity = op;
    }
  }

  function paint() {
    const { fraction, state } = current;
    const n = ticks.length;
    const lit = fraction * n; // 켜질 눈금 수 (소수점 = 경계 눈금의 밝기)

    for (let i = 0; i < n; i++) {
      const tick = ticks[i];
      if (state === 'done') {
        setTick(tick, true, 1);
      } else if (state === 'empty') {
        setTick(tick, false, OFF_EMPTY);
      } else if (i + 1 <= lit) {
        setTick(tick, true, 1);
      } else if (i < lit) {
        setTick(tick, true, Math.max(OFF_NEAR, lit - i)); // 경계 눈금은 서서히 꺼짐
      } else {
        const t = (i - lit) / Math.max(1, n - lit);
        setTick(tick, false, OFF_NEAR - (OFF_NEAR - OFF_FAR) * t);
      }
    }
  }

  /**
   * @param {number} fraction 남은 비율 0~1
   * @param {'normal'|'warn'|'paused'|'done'|'empty'} state
   */
  function update(fraction, state) {
    const f = Math.min(1, Math.max(0, fraction));
    if (Math.abs(f - current.fraction) < 1e-4 && state === current.state) return;
    current = { fraction: f, state };
    if (container) container.dataset.state = state;
    paint();
  }

  return { init, update };
})();
