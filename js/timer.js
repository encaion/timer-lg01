/*
 * 타이머 상태와 시간 계산.
 *
 * 1초씩 빼는 방식 대신 종료 시각(endTime)을 저장하고 매번 endTime - 현재시각으로 계산한다.
 * 브라우저가 백그라운드 탭의 타이머를 늦춰도 남은 시간이 밀리지 않는다.
 */
const Timer = (() => {
  /**
   * mode: 'duration'(시간 지정) | 'target'(종료 시각)
   * status: 'idle' | 'running' | 'paused' | 'finished'
   * totalMs: 전체 시간 (진행률 계산용)
   * endTime: 종료 시각 ms (running/finished)
   * remainingMs: 남은 시간 (paused일 때 사용)
   */
  let state = idleState('duration');
  let alarmTimeout = null;
  let handlers = { onChange() {}, onFinish() {} };

  function idleState(mode) {
    return { mode, status: 'idle', totalMs: 0, endTime: 0, remainingMs: 0 };
  }

  function setHandlers(h) {
    handlers = { ...handlers, ...h };
  }

  function getState() {
    return { ...state };
  }

  function getRemaining() {
    switch (state.status) {
      case 'running': return Math.max(0, state.endTime - Date.now());
      case 'paused': return state.remainingMs;
      default: return 0;
    }
  }

  /** 0 ~ 1 */
  function getProgress() {
    if (state.status === 'finished') return 1;
    if (state.status === 'idle' || state.totalMs <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - getRemaining() / state.totalMs));
  }

  /**
   * 알람 발생용 1회성 타이머. 화면 갱신용 반복 타이머와 분리해
   * 백그라운드 탭에서도 제 시간에 울릴 가능성을 높인다.
   */
  function scheduleAlarm() {
    clearTimeout(alarmTimeout);
    alarmTimeout = setTimeout(check, Math.max(0, state.endTime - Date.now()) + 10);
  }

  /** 종료 시각이 지났으면 종료 처리. 화면 갱신, 탭 복귀, 절전 복귀 때도 호출된다. */
  function check() {
    if (state.status !== 'running') return;
    if (Date.now() >= state.endTime) finish();
    else scheduleAlarm();
  }

  function finish() {
    clearTimeout(alarmTimeout);
    state = { ...state, status: 'finished', remainingMs: 0 };
    handlers.onChange();
    handlers.onFinish();
  }

  function startDuration(ms) {
    if (!(ms > 0)) return;
    state = { mode: 'duration', status: 'running', totalMs: ms, endTime: Date.now() + ms, remainingMs: ms };
    scheduleAlarm();
    handlers.onChange();
  }

  function startUntil(endTime) {
    const ms = endTime - Date.now();
    if (!(ms > 0)) return;
    state = { mode: 'target', status: 'running', totalMs: ms, endTime, remainingMs: ms };
    scheduleAlarm();
    handlers.onChange();
  }

  /** 일시정지. 종료 시각 모드에서 재개하면 멈춰 있던 시간만큼 종료 시각이 밀린다. */
  function pause() {
    if (state.status !== 'running') return;
    clearTimeout(alarmTimeout);
    state = { ...state, status: 'paused', remainingMs: Math.max(0, state.endTime - Date.now()) };
    handlers.onChange();
  }

  function resume() {
    if (state.status !== 'paused') return;
    state = { ...state, status: 'running', endTime: Date.now() + state.remainingMs };
    scheduleAlarm();
    handlers.onChange();
  }

  function reset() {
    clearTimeout(alarmTimeout);
    state = idleState(state.mode);
    handlers.onChange();
  }

  /**
   * 저장된 상태 복구 (F7)
   * @returns {'running'|'paused'|'expired'|null}
   */
  function restore(saved) {
    if (!saved) return null;
    if (saved.status === 'paused') {
      state = {
        mode: saved.mode,
        status: 'paused',
        totalMs: saved.totalMs,
        endTime: 0,
        remainingMs: Math.min(saved.remainingMs, saved.totalMs),
      };
      return 'paused';
    }
    if (saved.status === 'running' && saved.endTime > Date.now()) {
      state = {
        mode: saved.mode,
        status: 'running',
        totalMs: saved.totalMs,
        endTime: saved.endTime,
        remainingMs: 0,
      };
      scheduleAlarm();
      return 'running';
    }
    // 창이 닫혀 있는 동안 종료됨
    return 'expired';
  }

  /**
   * 종료 시각(시, 분) → 실제 종료 시각 ms.
   * 현재보다 이전이거나 같으면 다음 날로 처리 (D1).
   */
  function computeTargetEnd(hour, minute, now = Date.now()) {
    const d = new Date(now);
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  return {
    setHandlers,
    getState,
    getRemaining,
    getProgress,
    check,
    startDuration,
    startUntil,
    pause,
    resume,
    reset,
    restore,
    computeTargetEnd,
  };
})();
