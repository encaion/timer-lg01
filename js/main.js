/*
 * 초기화, 이벤트 연결, 단축키.
 */
(() => {
  const TICK_MS = 250;

  const settings = Store.loadSettings();
  let mode = settings.lastMode; // 대기 상태에서 선택된 모드
  let notice = ''; // 예: '14:35에 종료됨' (복구 시 안내)
  let swallowNextClick = false;

  function saveSettings() {
    Store.saveSettings(settings);
  }

  function render() {
    const timer = Timer.getState();
    if (timer.status !== 'idle') mode = timer.mode;
    UI.render({
      mode,
      timer,
      remaining: Timer.getRemaining(),
      progress: Timer.getProgress(),
      notice,
      now: Date.now(),
    });
  }

  function unlockAudio() {
    Alarm.unlock().then(() => {
      if (Alarm.isUnlocked()) UI.showAudioHint(false);
    });
  }

  /* ---------- 타이머 조작 ---------- */

  function start() {
    if (Timer.getState().status !== 'idle') return;
    unlockAudio(); // 시작 버튼 클릭 시점에 소리 재생 권한 확보
    UI.normalizeAll();
    UI.blurInputs();
    notice = '';

    if (mode === 'duration') {
      const { minutes, seconds } = UI.readDuration();
      const ms = (minutes * 60 + seconds) * 1000;
      if (ms <= 0) {
        render();
        return;
      }
      settings.lastMinutes = minutes;
      settings.lastSeconds = seconds;
      settings.lastMode = 'duration';
      saveSettings();
      Timer.startDuration(ms);
    } else {
      const target = UI.readTarget();
      if (!target) {
        render();
        return;
      }
      settings.lastTargetTime = `${UI.pad2(target.hour)}:${UI.pad2(target.minute)}`;
      settings.lastMode = 'target';
      saveSettings();
      Timer.startUntil(Timer.computeTargetEnd(target.hour, target.minute));
    }
  }

  /** 알람 정지 + 대기 상태로. 진행 중 모드 전환·빠른 설정 때도 사용 */
  function resetTimer() {
    Alarm.stop();
    Timer.reset();
  }

  /** 시작 / 일시정지 / 재개 / 알람 정지 */
  function primaryAction() {
    const timer = Timer.getState();
    switch (timer.status) {
      case 'idle':
        start();
        break;
      case 'running':
        Timer.pause();
        break;
      case 'paused':
        Timer.resume();
        break;
      case 'finished':
        resetTimer();
        break;
    }
  }

  Timer.setHandlers({
    onChange() {
      Store.saveState(Timer.getState());
      render();
    },
    onFinish() {
      Alarm.start(settings);
    },
  });

  /* ---------- 초기화 ---------- */

  Alarm.setVolume(settings.volume);

  // 데스크톱 알림 사용 가능 여부
  const notifySupported = 'Notification' in window && location.protocol !== 'file:';
  if (!notifySupported) {
    settings.notify = false;
    UI.el.notifyToggle.disabled = true;
    UI.setNotifyNote(
      location.protocol === 'file:'
        ? '파일을 직접 연 경우에는 사용할 수 없습니다 (GitHub Pages 주소에서 사용 가능)'
        : '이 브라우저는 데스크톱 알림을 지원하지 않습니다'
    );
  } else if (settings.notify && Notification.permission !== 'granted') {
    settings.notify = false;
  }

  UI.init(settings);

  // 새로고침·재접속 시 복구 (F7)
  const saved = Store.loadState();
  const restored = Timer.restore(saved);
  if (restored === 'running' || restored === 'paused') {
    mode = Timer.getState().mode;
    if (settings.sound && !Alarm.isUnlocked()) UI.showAudioHint(true);
  } else if (restored === 'expired') {
    notice = `${UI.dayLabel(saved.endTime)}${UI.formatTimeOfDay(saved.endTime)}에 종료됨`;
    Store.saveState(null);
  }

  /* ---------- 이벤트 ---------- */

  UI.el.primary.addEventListener('click', primaryAction);
  UI.el.secondary.addEventListener('click', resetTimer);

  // 모드 탭: 다른 모드를 누르면 진행 중이던 타이머는 초기화
  UI.el.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const next = tab.dataset.mode;
      if (next === mode) return;
      if (Timer.getState().status !== 'idle') resetTimer();
      mode = next;
      settings.lastMode = mode;
      saveSettings();
      notice = '';
      render();
    });
  });

  // 빠른 설정: 입력칸에 값만 넣고 자동 시작하지 않음. 진행 중이면 기존 타이머 초기화
  UI.el.quickButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (Timer.getState().status !== 'idle') resetTimer();
      UI.setDuration(Number(btn.dataset.minutes), 0);
      notice = '';
      render();
    });
  });

  UI.timeInputs.forEach((input) => {
    input.addEventListener('input', () => {
      notice = '';
      render();
    });
    input.addEventListener('change', () => {
      UI.normalizeField(input);
      render();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        start();
      }
    });
  });

  // 설정
  UI.el.settingsToggle.addEventListener('click', () => UI.toggleSettings());

  [
    ['sound', UI.el.soundToggle],
    ['blink', UI.el.blinkToggle],
    ['titleBlink', UI.el.titleBlinkToggle],
  ].forEach(([key, input]) => {
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      saveSettings();
    });
  });

  UI.el.notifyToggle.addEventListener('change', async () => {
    const toggle = UI.el.notifyToggle;
    if (!toggle.checked) {
      settings.notify = false;
      UI.setNotifyNote('');
      saveSettings();
      return;
    }
    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch (e) {
        permission = 'denied';
      }
    }
    if (permission === 'granted') {
      settings.notify = true;
      UI.setNotifyNote('');
    } else {
      settings.notify = false;
      toggle.checked = false;
      UI.setNotifyNote('알림 권한이 차단되어 있습니다. 주소창 왼쪽 아이콘에서 알림을 허용해 주세요.');
    }
    saveSettings();
  });

  UI.el.volume.addEventListener('input', () => {
    settings.volume = Number(UI.el.volume.value) / 100;
    Alarm.setVolume(settings.volume);
    UI.setVolumeLabel(settings.volume);
    saveSettings();
  });

  UI.el.testSound.addEventListener('click', () => {
    unlockAudio();
    Alarm.test();
  });

  // 화면 아무 곳이나 누르면: 소리 권한 확보 + 알람 중이면 정지
  document.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (Timer.getState().status === 'finished') {
      resetTimer();
      // 이어지는 click이 '시작' 등으로 처리되지 않도록 막는다.
      // 단, 모드 탭·빠른 설정 버튼은 알람을 끄면서 바로 동작하게 둔다.
      const target = e.target instanceof Element ? e.target : null;
      swallowNextClick = !(target && target.closest('.mode-tab, .quick .chip'));
    } else {
      swallowNextClick = false;
    }
  }, true);

  document.addEventListener('click', (e) => {
    if (!swallowNextClick) return;
    swallowNextClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // Space: 시작 / 일시정지 / 재개 / 알람 정지
  document.addEventListener('keydown', (e) => {
    swallowNextClick = false;
    unlockAudio();
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const target = e.target;
    if (target instanceof HTMLInputElement && (target.type === 'number' || target.type === 'text')) return;
    e.preventDefault();
    if (e.repeat) return;
    // 포커스된 버튼·스위치가 Space로 한 번 더 눌리지 않도록 포커스 해제
    if (target instanceof HTMLElement && target !== document.body) target.blur();
    primaryAction();
  });

  // 탭 복귀, 절전 해제 시 즉시 재계산
  document.addEventListener('visibilitychange', () => {
    Timer.check();
    render();
  });

  setInterval(() => {
    Timer.check();
    render();
  }, TICK_MS);

  render();
})();
