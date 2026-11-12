/*
 * localStorage 읽기/쓰기.
 * 시크릿 창이나 저장소 차단 상태에서도 타이머는 동작해야 하므로 모든 접근을 try/catch로 감싼다.
 * (브라우저 내장 객체 Storage와 이름이 겹치지 않도록 Store로 명명)
 */
const Store = (() => {
  const SETTINGS_KEY = 'timer.settings';
  const STATE_KEY = 'timer.state';
  const VERSION = 1;

  const DEFAULT_SETTINGS = Object.freeze({
    version: VERSION,
    sound: true,
    blink: true,
    titleBlink: true,
    notify: false,
    volume: 0.7,
    lastMinutes: 25,
    lastSeconds: 0,
    lastTargetTime: '',
    lastMode: 'duration',
  });

  function read(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 저장 실패는 무시 */
    }
  }

  function remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      /* 무시 */
    }
  }

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  /** 저장된 설정을 읽고, 없거나 형식이 틀린 값은 기본값으로 채운다. */
  function loadSettings() {
    const s = { ...DEFAULT_SETTINGS };
    const saved = read(SETTINGS_KEY);
    if (!saved || typeof saved !== 'object') return s;

    ['sound', 'blink', 'titleBlink', 'notify'].forEach((key) => {
      if (typeof saved[key] === 'boolean') s[key] = saved[key];
    });
    if (typeof saved.volume === 'number' && saved.volume >= 0 && saved.volume <= 1) {
      s.volume = saved.volume;
    }
    s.lastMinutes = clampInt(saved.lastMinutes, 0, 999, s.lastMinutes);
    s.lastSeconds = clampInt(saved.lastSeconds, 0, 59, s.lastSeconds);
    if (typeof saved.lastTargetTime === 'string' && /^\d{2}:\d{2}$/.test(saved.lastTargetTime)) {
      s.lastTargetTime = saved.lastTargetTime;
    }
    if (saved.lastMode === 'duration' || saved.lastMode === 'target') {
      s.lastMode = saved.lastMode;
    }
    return s;
  }

  function saveSettings(settings) {
    write(SETTINGS_KEY, { ...settings, version: VERSION });
  }

  /** 진행 중이던 타이머 상태. 형식이 틀리면 null. */
  function loadState() {
    const st = read(STATE_KEY);
    if (!st || typeof st !== 'object') return null;
    if (st.mode !== 'duration' && st.mode !== 'target') return null;
    if (!['running', 'paused', 'finished'].includes(st.status)) return null;
    if (!Number.isFinite(st.totalMs) || st.totalMs <= 0) return null;
    if (st.status === 'paused') {
      if (!Number.isFinite(st.remainingMs) || st.remainingMs < 0) return null;
    } else if (!Number.isFinite(st.endTime)) {
      return null;
    }
    return st;
  }

  /** 대기(idle) 상태면 저장된 상태를 지운다. */
  function saveState(state) {
    if (!state || state.status === 'idle') remove(STATE_KEY);
    else write(STATE_KEY, state);
  }

  return { loadSettings, saveSettings, loadState, saveState };
})();
