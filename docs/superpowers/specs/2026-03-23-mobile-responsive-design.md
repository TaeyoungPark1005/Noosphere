# Mobile Responsive Design Spec

**Date:** 2026-03-23
**Scope:** 모바일(≤640px) 반응형 레이아웃 전체 개선
**Approach:** CSS 클래스 + `index.css` media queries

---

## 제외 범위

- `LandingDemoWindow` — 추후 영상으로 대체 예정

---

## 기술 전제

모든 대상 요소가 인라인 스타일(`style={{ ... }}`)로 작성되어 있어, CSS media query로 덮어쓰려면 `!important`가 불가피하다. 이는 기존 코드 패턴(`platform-btn` 등)과 동일한 방식이다.

---

## 1. LandingPage (`LandingPage.tsx`)

### 1-1. Nav

**문제:** `padding: 14px 48px` 고정, 링크+버튼이 가로 나열돼 모바일에서 squeeze.

**수정:**
- `<nav>` → `className="landing-nav"`
- 링크 그룹 `<div>` → `className="landing-nav-links"` → 모바일 `display:none`
- Sign in `<Link>` → `className="landing-nav-signin"` → 모바일 `display:none`
- 햄버거 버튼 추가 → `className="landing-hamburger"` (데스크탑 `display:none`, 모바일 `display:flex`)
  - 최소 터치 타겟 44×44px 확보 (`padding: 12px`)
- 슬라이드+페이드 드롭다운 → `className="landing-mobile-menu"` (Slide+Fade B 스타일)
  - 기본: `opacity:0`, `transform:translateY(-8px)`, `max-height:0`
  - `.open`: `opacity:1`, `transform:translateY(0)`, `max-height:200px`
  - transition: `0.28s ease`
- `LandingPage`에 `menuOpen` state 추가
- 햄버거 클릭 시 토글, 메뉴 외부 클릭 시 닫힘 (`useEffect` + `mousedown` listener)
- 햄버거 아이콘 → 열리면 3개 bar가 X로 transform

### 1-2. Hero

**문제:** h1 `fontSize:56` 모바일에서 너무 큼. CTA 버튼 2개 가로 배치 좁음.

**수정:**
- `<h1>` → `className="landing-hero-h1"` → 모바일 `font-size:30px`
- CTA 감싸는 `<div>` → `className="landing-hero-cta"` → 모바일 `flex-direction:column`

### 1-3. How it works

**문제:** 각 행 `display:flex, gap:28` + `minWidth:160` 타이틀 칼럼 → 모바일에서 overflow/세로로 길어짐.

**수정:**
- 각 step `<div>` → `className="landing-how-row"` → 모바일 `flex-direction:column`, `gap:6px`, `padding:20px 18px`
- 세로 구분선 `<div>` → `className="landing-how-divider"` → 모바일 `display:none`
- 타이틀 `<div>` → `className="landing-how-title"` → 모바일 `min-width:unset`

### 1-4. Footer

**문제:** `padding:20px 48px` 가로 패딩 과다.

**수정:**
- `<footer>` → `className="landing-footer"` → 모바일 `flex-direction:column`, `align-items:center`, `padding:14px 20px`, `gap:4px`

---

## 2. HomePage (`HomePage.tsx`)

**문제:** Advanced options `gridTemplateColumns:'1fr 1fr'` 2열 그리드가 모바일에서 좁음.

**수정:**
- simulation 탭 grid `<div>` + research 탭 grid `<div>` 모두 → `className="options-grid"` → 모바일 `grid-template-columns:1fr`

---

## 3. ResultPage (`ResultPage.tsx`)

### 3-1. Verdict 카드

**문제:** verdict 텍스트 + PDF 버튼 `space-between` 한 줄 → 모바일 squeeze.

**수정:**
- verdict `<div>` → `className="result-verdict-card"` → 모바일 `flex-direction:column`, `align-items:flex-start`, `gap:10px`

### 3-2. 탭 바

**문제:** 탭 4개 + 다운로드 버튼 한 줄 → 모바일 overflow.

**수정:**
- 탭 감싸는 `<div>` → `className="result-tabs"` → 모바일 `overflow-x:auto`, 스크롤바 숨김
- Note: 각 탭 버튼의 `borderBottom` 표시는 컨테이너 overflow와 무관 (버튼 내부 속성)

---

## 4. SimulatePage (`SimulatePage.tsx`)

### 4-1. isSourcing 2열 레이아웃

**문제:** `isSourcing` 조건 시 `<main>`이 `display:flex, gap:24` 2열 (그래프 flex:3 + 피드 flex:2) → 모바일에서 심각한 overflow.

**수정:**
- 해당 `<main>` → `className="sim-sourcing-layout"` → 모바일 `flex-direction:column`

### 4-2. PlatformSimFeed 탭

`PlatformSimFeed.tsx` 내부 탭 div에 이미 `flexWrap:'wrap'`이 있어 줄바꿈됨 → **수정 불필요**.

---

## 5. HistoryPage (`HistoryPage.tsx`)

**문제:** 아이템 내부 `space-between` 행에서 텍스트 + 버튼 그룹이 모바일에서 overflow 가능.

**수정:**
- 아이템 내부 `<div>` (line 110) → `className="history-item-row"` → 모바일 `flex-direction:column`, `align-items:flex-start`, `gap:8px`
- 버튼 그룹 `<div>` (line 114) → `className="history-item-actions"` 추가 (너비 auto 유지 위해 `align-self:flex-start` 확보)

---

## 6. index.css 추가 내용

```css
/* ── 모바일 반응형 (≤640px) ─────────────────────────── */

/* Landing nav hamburger: 데스크탑에서 숨김 */
.landing-hamburger { display: none; }

@media (max-width: 640px) {
  /* Landing nav */
  .landing-nav         { padding: 12px 18px !important; }
  .landing-nav-links   { display: none !important; }
  .landing-nav-signin  { display: none !important; }
  .landing-hamburger   { display: flex !important; align-items: center; justify-content: center; }

  /* Landing mobile menu (Slide+Fade) */
  .landing-mobile-menu {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transform: translateY(-8px);
    transition: max-height 0.28s ease, opacity 0.28s ease, transform 0.28s ease;
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
  }
  .landing-mobile-menu.open {
    max-height: 200px;
    opacity: 1;
    transform: translateY(0);
  }

  /* Landing hero */
  .landing-hero-h1  { font-size: 30px !important; }
  .landing-hero-cta { flex-direction: column !important; }

  /* Landing how it works */
  .landing-how-row     { flex-direction: column !important; gap: 6px !important; padding: 20px 18px !important; }
  .landing-how-divider { display: none !important; }
  .landing-how-title   { min-width: unset !important; }

  /* Landing footer */
  .landing-footer {
    flex-direction: column !important;
    align-items: center !important;
    padding: 14px 20px !important;
    gap: 4px !important;
    text-align: center;
  }

  /* HomePage advanced options */
  .options-grid { grid-template-columns: 1fr !important; }

  /* ResultPage verdict */
  .result-verdict-card {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 10px !important;
  }

  /* ResultPage tabs */
  .result-tabs {
    overflow-x: auto !important;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .result-tabs::-webkit-scrollbar { display: none; }

  /* SimulatePage sourcing layout */
  .sim-sourcing-layout { flex-direction: column !important; }

  /* HistoryPage item row */
  .history-item-row {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 8px !important;
  }
  .history-item-actions { align-self: flex-start; }
}
```

---

## 변경 파일 목록

- `frontend/src/index.css`
- `frontend/src/pages/LandingPage.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/ResultPage.tsx`
- `frontend/src/pages/SimulatePage.tsx`
- `frontend/src/pages/HistoryPage.tsx`

---

## 완료 기준

- 320px~640px 뷰포트에서 모든 화면 가로 overflow 없음
- 햄버거 메뉴: Slide+Fade 애니메이션으로 열리고 닫힘
- 햄버거 → X 아이콘 transform 동작
- 메뉴 외부 클릭 시 닫힘
- 데스크탑(≥641px) 레이아웃 변경 없음
