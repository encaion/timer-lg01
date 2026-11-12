/*
 * 종료 알림: 소리(Web Audio), 화면 깜빡임, 탭 제목 깜빡임, 데스크톱 알림, 파비콘 교체.
 */
const Alarm = (() => {
  const APP_TITLE = '타이머';
  const ALARM_TITLE = '⏰ 시간 종료!';
  const FAVICON_NORMAL = 'assets/favicon.svg';
  const FAVICON_ALARM = 'assets/favicon-alarm.svg';

  // 비프음 패턴: 삐(0.15초) 쉼(0.1초) × 3회, 한 주기 1.6초
  const BEEP_FREQ = 880;
  const BEEP_ON = 0.15;
  const BEEP_GAP = 0.1;
  const BEEPS_PER_CYCLE = 3;
  const CYCLE_SEC = 1.6;
  const SOUND_MAX_SEC = 60;

  let ctx = null;
  let volume = 0.7;
  let ringing = null; // 알람 소리
  let testing = null; // 소리 테스트
  let titleTimer = null;
  let notification = null;

  function getContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) ctx = new AudioCtx();
    return ctx;
  }

  /**
   * 브라우저 자동재생 제한 해제. 사용자 클릭/키 입력 처리 중에 호출해야 한다.
   * @returns {Promise<void>}
   */
  function unlock() {
    const c = getContext();
    if (c && c.state === 'suspended') return c.resume().catch(() => {});
    return Promise.resolve();
  }

  function isUnlocked() {
    return !!ctx && ctx.state === 'running';
  }

  /** 볼륨(0~1)을 실제 음량으로 변환. 사람 귀에 자연스럽도록 제곱 사용. */
  function toGain(v) {
    return v * v * 0.25;
  }

  /**
   * 비프음을 오디오 시계 기준으로 미리 예약해 재생한다.
   * 오디오 시계는 백그라운드 탭에서도 늦춰지지 않으므로 반복 타이머 없이 정확하게 울린다.
   */
  function playBeeps(durationSec) {
    const c = getContext();
    if (!c) return null;
    if (c.state === 'suspended') c.resume().catch(() => {});

    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = BEEP_FREQ;

    const envelope = c.createGain();
    envelope.gain.value = 0;
    const master = c.createGain();
    master.gain.value = toGain(volume);

    osc.connect(envelope);
    envelope.connect(master);
    master.connect(c.destination);

    const start = c.currentTime + 0.05;
    const g = envelope.gain;
    g.setValueAtTime(0, start);
    const cycles = Math.ceil(durationSec / CYCLE_SEC);
    for (let i = 0; i < cycles; i++) {
      for (let b = 0; b < BEEPS_PER_CYCLE; b++) {
        const t = start + i * CYCLE_SEC + b * (BEEP_ON + BEEP_GAP);
        if (t >= start + durationSec) break;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(1, t + 0.01);
        g.setValueAtTime(1, t + BEEP_ON - 0.01);
        g.linearRampToValueAtTime(0, t + BEEP_ON);
      }
    }

    osc.start(start);
    osc.stop(start + durationSec);

    const handle = { osc, master };
    osc.onended = () => {
      try { master.disconnect(); } catch (e) { /* 무시 */ }
      if (ringing === handle) ringing = null;
      if (testing === handle) testing = null;
    };
    return handle;
  }

  function stopHandle(handle) {
    if (!handle) return;
    try {
      handle.osc.onended = null;
      handle.osc.stop();
    } catch (e) { /* 이미 멈춤 */ }
    try { handle.master.disconnect(); } catch (e) { /* 무시 */ }
  }

  function setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    [ringing, testing].forEach((h) => {
      if (h) h.master.gain.value = toGain(volume);
    });
  }

  /** 설정 화면의 '소리 테스트': 한 주기만 재생 */
  function test() {
    stopHandle(testing);
    testing = playBeeps(CYCLE_SEC);
  }

  function startTitleBlink() {
    stopTitleBlink();
    let on = true;
    document.title = ALARM_TITLE;
    titleTimer = setInterval(() => {
      on = !on;
      document.title = on ? ALARM_TITLE : APP_TITLE;
    }, 1000);
  }

  function stopTitleBlink() {
    if (titleTimer) clearInterval(titleTimer);
    titleTimer = null;
  }

  function setFavicon(alarming) {
    const link = document.getElementById('favicon');
    if (link) link.href = alarming ? FAVICON_ALARM : FAVICON_NORMAL;
  }

  function showNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      notification = new Notification(ALARM_TITLE, {
        body: '타이머가 끝났습니다.',
        tag: 'timer-alarm',
        requireInteraction: true,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      notification = null;
    }
  }

  /**
   * 알람 시작
   * @param {{sound:boolean, blink:boolean, titleBlink:boolean, notify:boolean}} opts
   */
  function start(opts) {
    stop();
    if (opts.sound) ringing = playBeeps(SOUND_MAX_SEC); // 60초 후 자동으로 멈춤
    if (opts.blink) document.body.classList.add('blinking');
    if (opts.titleBlink) startTitleBlink();
    else document.title = ALARM_TITLE;
    if (opts.notify) showNotification();
    setFavicon(true);
  }

  function stop() {
    stopHandle(ringing);
    ringing = null;
    document.body.classList.remove('blinking');
    stopTitleBlink();
    if (notification) {
      try { notification.close(); } catch (e) { /* 무시 */ }
      notification = null;
    }
    setFavicon(false);
  }

  return { unlock, isUnlocked, setVolume, test, start, stop };
})();
