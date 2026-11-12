# 04. 구조 및 로직

## 백엔드
**만들지 않는다.** GitHub Pages는 정적 파일만 제공하며, 이 프로젝트는 아래 이유로 서버가 필요 없다.
- 사용자 1명, 기기 간 동기화 없음 → 저장은 브라우저 localStorage로 충분
- 시간 계산은 PC 시계 기준으로 브라우저에서 처리
- 로그인, 공유, 외부 데이터 없음

나중에 여러 기기 동기화가 필요해지면 Firebase / Supabase 같은 외부 서비스를 붙이는 방식으로 확장 가능.

## 파일 구조

```
04_timer/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── storage.js   # localStorage 읽기/쓰기
│   ├── alarm.js     # 소리, 화면/탭 제목 깜빡임, 데스크톱 알림
│   ├── timer.js     # 타이머 상태와 시간 계산
│   ├── dial.js      # 남은 시간 테두리 눈금 (SVG)
│   ├── ui.js        # 화면 표시, 입력 처리
│   └── main.js      # 초기화, 이벤트 연결, 단축키
├── assets/
│   ├── favicon.svg
│   └── favicon-alarm.svg   # 알람 중 표시용
├── .nojekyll        # GitHub Pages의 Jekyll 변환 끄기
└── md/              # 문서 (이 폴더)
```

- `<script type="module">`(ES 모듈)은 쓰지 않고 일반 `<script>`를 순서대로 불러온다.
  - 이유: ES 모듈은 `index.html`을 더블클릭해 `file://`로 열면 동작하지 않음. 일반 스크립트는 로컬에서도 바로 열림.
  - 전역 변수 충돌을 막기 위해 파일마다 객체 하나만 노출 (`Store`, `Alarm`, `Timer`, `UI`).
  - 저장 담당 객체 이름을 `Storage`로 하지 않는 이유: 브라우저에 같은 이름의 내장 객체가 있음.

## 타이머 상태

```js
{
  mode: 'duration' | 'target',          // 시간 지정 / 종료 시각
  status: 'idle' | 'running' | 'paused' | 'finished',
  totalMs: 1500000,                     // 전체 시간 (진행률 계산용)
  endTime: 1762912520000,               // 종료 시각 (running일 때, Date.now() 기준 ms)
  remainingMs: 600000                   // 남은 시간 (paused일 때만 사용)
}
```

## 시간 계산 방식 (중요)

**"1초마다 1씩 빼기" 방식을 쓰지 않는다.**
브라우저는 보이지 않는 탭의 타이머를 늦추기 때문에, 1초씩 빼면 시간이 점점 밀린다.

대신:
1. 시작 시 `endTime = Date.now() + 남은시간` 을 저장
2. 화면 갱신 때마다 `남은시간 = endTime - Date.now()` 로 다시 계산
3. 일시정지 시 `remainingMs = endTime - Date.now()` 저장, 재개 시 `endTime`을 새로 계산

이렇게 하면 탭이 늦게 갱신되더라도 표시 시간은 항상 정확하다.
종료 시각 모드는 처음부터 `endTime`을 입력값으로 정하면 되므로 같은 구조로 처리된다.

### 갱신 주기
| 용도 | 방식 |
|---|---|
| 화면 숫자 갱신 | `setInterval` 250ms (초가 바뀌는 순간을 놓치지 않도록 1초보다 짧게) |
| 알람 발생 | 시작 시 `setTimeout(알람, 남은시간)` **1회** 별도 예약 |
| 탭 복귀 시 | `visibilitychange` 이벤트에서 즉시 재계산 |

알람을 반복 타이머와 분리하는 이유: Chrome은 5분 이상 숨겨진 탭의 **반복** 타이머를 최대 1분 간격까지 늦출 수 있다. 1회성 `setTimeout`은 이 제한을 덜 받아서 알람이 제 시간에 울릴 가능성이 높다. (테스트 항목 T-BG에서 실제 확인)

### 종료 시각 계산 (F2)
```
target = 오늘 날짜 + 입력한 HH:MM:00
if (target <= now) target = target + 1일
endTime = target
```

## 소리 (Web Audio API)
- 파일 없이 `OscillatorNode`로 비프음 생성 (예: 880Hz, 0.2초 울림 / 0.2초 쉼 × 3회, 1초 쉬고 반복)
- 브라우저 자동재생 제한: 사용자가 클릭하기 전에는 소리를 낼 수 없음
  → `시작` 버튼 클릭 시 `AudioContext`를 생성·`resume()` 해 둔다
- 새로고침 후 복구된 타이머는 클릭 이력이 없으므로, 화면에 `소리를 켜려면 화면을 한 번 클릭하세요` 안내 표시

## 데스크톱 알림
- `Notification.requestPermission()` 으로 권한 요청 (설정에서 켤 때)
- HTTPS 또는 `localhost`에서만 동작. `file://`로 열면 사용 불가 → 해당 경우 설정 항목 비활성화
- 권한이 거부되면 설정을 off로 되돌리고 안내 문구 표시

## 저장 구조 (localStorage)

| 키 | 내용 |
|---|---|
| `timer.settings` | 알림 설정, 볼륨, 마지막 입력값, 마지막 모드 |
| `timer.state` | 진행 중 타이머 상태 (복구용) |

```json
// timer.settings
{
  "version": 1,
  "sound": true,
  "blink": true,
  "titleBlink": true,
  "notify": false,
  "volume": 0.7,
  "lastMinutes": 25,
  "lastSeconds": 0,
  "lastTargetTime": "15:05",
  "lastMode": "duration"
}
```

- 읽기/쓰기는 모두 `try/catch`로 감싼다 (시크릿 창, 저장소 차단 시에도 타이머 자체는 동작해야 함)
- 읽은 값이 없거나 형식이 틀리면 기본값 사용
- `version` 필드로 나중에 구조가 바뀌어도 대응

## 주의 사항
- 기준 시각은 PC 시계. PC 시계가 틀리면 종료 시각 모드도 틀린다.
- 타이머 진행 중 PC가 절전 모드에 들어가면 그동안 알람이 울리지 않는다. 깨어난 뒤 종료 시각이 지났으면 즉시 알람.
- 같은 페이지를 탭 두 개로 열면 상태가 서로 덮어쓸 수 있다 → 개인용이라 별도 처리하지 않음.
