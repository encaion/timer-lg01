/*
 * 화면 표시와 입력값 처리.
 */
const UI = (() => {
  const APP_TITLE = '타이머';
  const WARN_MS = 10000; // 마지막 10초 강조
  const $ = (id) => document.getElementById(id);

  const el = {
    tabs: Array.from(document.querySelectorAll('.mode-tab')),
    display: $('display'),
    subInfo: $('subInfo'),
    dial: $('dial'),
    durationInputs: $('durationInputs'),
    targetInputs: $('targetInputs'),
    minutes: $('minutesInput'),
    seconds: $('secondsInput'),
    hour: $('hourInput'),
    minute: $('minuteInput'),
    quickButtons: Array.from(document.querySelectorAll('.quick .chip')),
    primary: $('primaryBtn'),
    secondary: $('secondaryBtn'),
    audioHint: $('audioHint'),
    settingsToggle: $('settingsToggle'),
    settingsPanel: $('settingsPanel'),
    soundToggle: $('soundToggle'),
    blinkToggle: $('blinkToggle'),
    titleBlinkToggle: $('titleBlinkToggle'),
    notifyToggle: $('notifyToggle'),
    notifyNote: $('notifyNote'),
    volume: $('volumeInput'),
    volumeValue: $('volumeValue'),
    testSound: $('testSoundBtn'),
  };

  const timeInputs = [el.minutes, el.seconds, el.hour, el.minute];

  /* ---------- 형식 변환 ---------- */

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function clampInt(value, min, max) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  /** 남은 시간 → HH:MM:SS (1시간 미만은 MM:SS). 초는 올림. */
  function formatClock(ms) {
    const total = Math.ceil(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
  }

  function formatTimeOfDay(ts, withSeconds = false) {
    const d = new Date(ts);
    const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return withSeconds ? `${hm}:${pad2(d.getSeconds())}` : hm;
  }

  /** 오늘이면 빈 문자열, 내일/어제면 '내일 '/'어제 ', 그 외는 'M/D ' */
  function dayLabel(ts, now = Date.now()) {
    const startOfDay = (t) => {
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const diff = Math.round((startOfDay(ts) - startOfDay(now)) / 86400000);
    if (diff === 0) return '';
    if (diff === 1) return '내일 ';
    if (diff === -1) return '어제 ';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} `;
  }

  /** 1시간 45분 / 45분 / 2시간 (분 단위 올림) */
  function formatDurationText(ms) {
    const totalMin = Math.max(1, Math.ceil(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h && m) return `${h}시간 ${m}분`;
    if (h) return `${h}시간`;
    return `${m}분`;
  }

  /**
   * 종료 시각 모드 보조 정보: '21:00 종료(1시간 후)', '내일 07:00 종료(9시간 30분 후)'
   * 일시정지 후 재개해 종료 시각이 초 단위로 밀린 경우에만 초까지 표시
   */
  function formatTargetEnd(end, now) {
    const withSeconds = new Date(end).getSeconds() !== 0;
    return `${dayLabel(end, now)}${formatTimeOfDay(end, withSeconds)} 종료(${formatDurationText(end - now)} 후)`;
  }

  /* ---------- 입력값 ---------- */

  function readDuration() {
    return {
      minutes: clampInt(el.minutes.value, 0, 999),
      seconds: clampInt(el.seconds.value, 0, 59),
    };
  }

  /** 시가 비어 있으면 null. 분이 비어 있으면 0분. */
  function readTarget() {
    if (el.hour.value.trim() === '') return null;
    return {
      hour: clampInt(el.hour.value, 0, 23),
      minute: clampInt(el.minute.value, 0, 59),
    };
  }

  function setDuration(minutes, seconds) {
    el.minutes.value = String(minutes);
    el.seconds.value = pad2(seconds);
  }

  /** 입력칸 값을 범위 안으로 보정하고 보기 좋게 정리 (예: 초 7 → 07, 초 75 → 59) */
  function normalizeField(input) {
    const raw = input.value.trim();
    if (input === el.minutes) {
      input.value = String(clampInt(raw, 0, 999));
    } else if (input === el.seconds) {
      input.value = pad2(clampInt(raw, 0, 59));
    } else if (input === el.hour) {
      input.value = raw === '' ? '' : pad2(clampInt(raw, 0, 23));
    } else if (input === el.minute) {
      input.value = raw === '' ? '' : pad2(clampInt(raw, 0, 59));
    }
  }

  function normalizeAll() {
    timeInputs.forEach(normalizeField);
  }

  function blurInputs() {
    const active = document.activeElement;
    if (active && timeInputs.includes(active)) active.blur();
  }

  /* ---------- 설정 화면 ---------- */

  function init(settings) {
    Dial.init(el.dial);
    setDuration(settings.lastMinutes, settings.lastSeconds);
    if (settings.lastTargetTime) {
      const [h, m] = settings.lastTargetTime.split(':');
      el.hour.value = h;
      el.minute.value = m;
    }
    el.soundToggle.checked = settings.sound;
    el.blinkToggle.checked = settings.blink;
    el.titleBlinkToggle.checked = settings.titleBlink;
    el.notifyToggle.checked = settings.notify;
    el.volume.value = String(Math.round(settings.volume * 100));
    setVolumeLabel(settings.volume);
  }

  function setVolumeLabel(volume) {
    el.volumeValue.textContent = `${Math.round(volume * 100)}%`;
  }

  function setNotifyNote(text) {
    el.notifyNote.textContent = text;
    el.notifyNote.hidden = !text;
  }

  function toggleSettings() {
    const open = el.settingsPanel.hidden;
    el.settingsPanel.hidden = !open;
    el.settingsToggle.setAttribute('aria-expanded', String(open));
  }

  function showAudioHint(show) {
    el.audioHint.hidden = !show;
  }

  /* ---------- 화면 그리기 ---------- */

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  /**
   * @param {{mode:string, timer:object, remaining:number, progress:number, notice:string, now:number}} ctx
   */
  function render(ctx) {
    const { mode, timer, remaining, progress, notice, now } = ctx;
    const status = timer.status;
    const idle = status === 'idle';

    // 모드 탭, 빠른 설정 버튼은 항상 누를 수 있음 (진행 중이면 기존 타이머 초기화)
    el.tabs.forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
    });
    el.durationInputs.hidden = mode !== 'duration';
    el.targetInputs.hidden = mode !== 'target';
    timeInputs.forEach((x) => { x.disabled = !idle; });

    // 남은 시간, 보조 정보
    let displayText;
    let sub = '';
    let canStart = false;

    if (idle && mode === 'duration') {
      const { minutes, seconds } = readDuration();
      const ms = (minutes * 60 + seconds) * 1000;
      displayText = formatClock(ms);
      sub = notice;
      canStart = ms > 0;
    } else if (idle && mode === 'target') {
      const target = readTarget();
      if (target) {
        const end = Timer.computeTargetEnd(target.hour, target.minute, now);
        displayText = formatClock(end - now);
        sub = notice || formatTargetEnd(end, now);
        canStart = true;
      } else {
        displayText = '--:--';
        sub = notice || '종료 시각을 입력하세요';
      }
    } else if (status === 'running') {
      displayText = formatClock(remaining);
      sub = timer.mode === 'target'
        ? formatTargetEnd(timer.endTime, now)
        : `${dayLabel(timer.endTime, now)}${formatTimeOfDay(timer.endTime, true)} 종료`;
    } else if (status === 'paused') {
      displayText = formatClock(remaining);
      sub = '일시정지됨';
    } else {
      displayText = formatClock(0);
      sub = '시간 종료!';
    }

    // 종료 시각 모드에서 시작 전에는 미리보기임을 알 수 있게 일시정지와 같은 흐린 효과
    const targetPreviewing = idle && mode === 'target';

    setText(el.display, displayText);
    el.display.classList.toggle('paused', status === 'paused' || targetPreviewing);
    el.display.classList.toggle('warn', status === 'running' && remaining <= WARN_MS);
    el.display.classList.toggle('done', status === 'finished');

    setText(el.subInfo, sub);
    el.subInfo.classList.toggle('alert', status === 'finished');

    // 테두리 눈금: 남은 비율만큼 켜짐
    let fraction;
    let dialState;
    if (idle) {
      fraction = canStart ? 1 : 0;
      if (!canStart) dialState = 'empty';
      else dialState = targetPreviewing ? 'paused' : 'normal';
    } else if (status === 'finished') {
      fraction = 0;
      dialState = 'done';
    } else {
      fraction = 1 - progress;
      if (status === 'paused') dialState = 'paused';
      else dialState = remaining <= WARN_MS ? 'warn' : 'normal';
    }
    Dial.update(fraction, dialState);

    // 버튼: 두 버튼 모두 항상 같은 자리·같은 크기로 표시 (글자만 바뀜)
    const primaryLabels = { idle: '시작', running: '일시정지', paused: '재개', finished: '알람 정지' };
    setText(el.primary, primaryLabels[status]);
    el.primary.disabled = idle && !canStart;
    el.primary.classList.toggle('btn-alarm', status === 'finished');
    el.secondary.disabled = idle;

    // 탭 제목 (알람 중에는 Alarm이 관리)
    if (status !== 'finished') {
      let title = APP_TITLE;
      if (status === 'running') title = `${displayText} - ${APP_TITLE}`;
      else if (status === 'paused') title = `⏸ ${displayText} - ${APP_TITLE}`;
      if (document.title !== title) document.title = title;
    }
  }

  return {
    el,
    timeInputs,
    pad2,
    formatTimeOfDay,
    dayLabel,
    readDuration,
    readTarget,
    setDuration,
    normalizeField,
    normalizeAll,
    blurInputs,
    init,
    setVolumeLabel,
    setNotifyNote,
    toggleSettings,
    showAudioHint,
    render,
  };
})();
