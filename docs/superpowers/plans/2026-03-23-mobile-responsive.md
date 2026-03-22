# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일(≤640px) 환경에서 전체 화면의 레이아웃 overflow 및 UI 문제 해결

**Architecture:** `index.css`에 `@media (max-width: 640px)` 블록을 추가하고, 각 컴포넌트의 문제 요소에 `className`을 부여하는 방식. 인라인 스타일을 덮어쓰기 위해 `!important` 사용이 불가피하며 이는 기존 코드 패턴과 동일하다.

**Tech Stack:** React, TypeScript, CSS media queries

---

## 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `frontend/src/index.css` | 수정 | `@media (max-width: 640px)` 블록 + `.landing-hamburger { display: none }` 추가 |
| `frontend/src/pages/LandingPage.tsx` | 수정 | `menuOpen` state + 햄버거 버튼 + 드롭다운 메뉴 + className 추가 |
| `frontend/src/pages/HomePage.tsx` | 수정 | options grid div에 `className="options-grid"` 추가 |
| `frontend/src/pages/ResultPage.tsx` | 수정 | verdict card + tabs div에 className 추가 |
| `frontend/src/pages/SimulatePage.tsx` | 수정 | isSourcing main에 `className="sim-sourcing-layout"` 추가 |
| `frontend/src/pages/HistoryPage.tsx` | 수정 | item row div에 className 추가 |

---

### Task 1: CSS media query 블록 추가

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: index.css 맨 끝에 다음 블록 추가**

```css
/* ── 모바일 반응형 (≤640px) ─────────────────────────── */

/* Landing hamburger: 데스크탑에서 숨김 (media query 밖에 위치) */
.landing-hamburger { display: none; }

@media (max-width: 640px) {
  /* Landing nav */
  .landing-nav        { padding: 12px 18px !important; }
  .landing-nav-links  { display: none !important; }
  .landing-nav-signin { display: none !important; }
  .landing-hamburger  { display: flex !important; align-items: center; justify-content: center; }

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

  /* ResultPage / SimulatePage tabs */
  .result-tabs {
    overflow-x: auto !important;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .result-tabs::-webkit-scrollbar { display: none; }

  /* SimulatePage sourcing 2열 레이아웃 */
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

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/index.css
git commit -m "style: 모바일 반응형 CSS media query 블록 추가"
```

---

### Task 2: LandingPage — 햄버거 메뉴

**Files:**
- Modify: `frontend/src/pages/LandingPage.tsx`

현재 nav 구조:
```
<nav>  ← padding: 14px 48px, display:flex, space-between
  <div>logo</div>
  <div>링크들</div>    ← 여기에 landing-nav-links
  <Link>Sign in</Link> ← 여기에 landing-nav-signin
</nav>
```

- [ ] **Step 1: `LandingPage` 함수 상단에 state와 ref 추가**

`export function LandingPage() {` 바로 아래 줄에 삽입:

```tsx
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])
```

파일 상단 import에 `useEffect, useRef` 추가:
```tsx
import { useState, useEffect, useRef } from 'react'
```

- [ ] **Step 2: `<nav>`를 wrapper `<div ref={menuRef}>`로 감싸기**

`menuRef`는 nav와 드롭다운 메뉴를 모두 포함하는 wrapper에 붙여야 한다.
드롭다운이 `<nav>` 밖에 위치하므로, ref를 nav에만 달면 드롭다운 내부 클릭 시 외부 클릭으로 오인되어 메뉴가 즉시 닫혀버린다.

기존:
```tsx
<nav style={{
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 48px',
  ...
}}>
  ...
</nav>
```

수정:
```tsx
<div ref={menuRef} style={{ position: 'relative' }}>
  <nav className="landing-nav" style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 48px',
    ...
  }}>
    ...
  </nav>
  {/* 드롭다운 메뉴는 이 div 안에 위치 — Step 6에서 추가 */}
</div>
```

- [ ] **Step 3: 링크 그룹 div에 className 추가**

기존:
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
  <a href="#how-it-works" ...>How it works</a>
  <a href="#platforms" ...>Platforms</a>
</div>
```

수정:
```tsx
<div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
  <a href="#how-it-works" ...>How it works</a>
  <a href="#platforms" ...>Platforms</a>
</div>
```

- [ ] **Step 4: Sign in 버튼에 className 추가**

기존:
```tsx
<Link to="/app" style={{ ... }}>
  Sign in →
</Link>
```

수정:
```tsx
<Link to="/app" className="landing-nav-signin" style={{ ... }}>
  Sign in →
</Link>
```

- [ ] **Step 5: 햄버거 버튼 추가** (Sign in 버튼 바로 뒤에 삽입)

```tsx
{/* 햄버거 버튼 — 모바일 전용 */}
<button
  className="landing-hamburger"
  onClick={() => setMenuOpen(o => !o)}
  aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
  aria-expanded={menuOpen}
  style={{
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 12, margin: -12,
    display: 'none', // CSS에서 모바일에서만 flex로 override
    flexDirection: 'column', gap: 4,
  }}
>
  <span style={{
    display: 'block', width: 20, height: 2, background: '#1e293b', borderRadius: 2,
    transition: 'transform 0.25s ease, opacity 0.25s ease',
    transform: menuOpen ? 'translateY(6px) rotate(45deg)' : 'none',
  }} />
  <span style={{
    display: 'block', width: 20, height: 2, background: '#1e293b', borderRadius: 2,
    transition: 'opacity 0.25s ease',
    opacity: menuOpen ? 0 : 1,
  }} />
  <span style={{
    display: 'block', width: 20, height: 2, background: '#1e293b', borderRadius: 2,
    transition: 'transform 0.25s ease, opacity 0.25s ease',
    transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none',
  }} />
</button>
```

- [ ] **Step 6: 드롭다운 메뉴 추가** (Step 2에서 만든 wrapper `<div>` 안, `</nav>` 닫기 태그 바로 뒤에 삽입)

```tsx
{/* 모바일 드롭다운 메뉴 */}
<div className={`landing-mobile-menu${menuOpen ? ' open' : ''}`}>
  <div style={{ padding: '8px 0 12px' }}>
    <a
      href="#how-it-works"
      onClick={() => setMenuOpen(false)}
      style={{ display: 'block', padding: '10px 20px', fontSize: 14, color: '#475569', textDecoration: 'none' }}
    >
      How it works
    </a>
    <a
      href="#platforms"
      onClick={() => setMenuOpen(false)}
      style={{ display: 'block', padding: '10px 20px', fontSize: 14, color: '#475569', textDecoration: 'none' }}
    >
      Platforms
    </a>
    <Link
      to="/app"
      onClick={() => setMenuOpen(false)}
      style={{
        display: 'block', margin: '6px 16px 0', padding: '10px 18px',
        background: '#1e293b', color: '#fff', borderRadius: 8,
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 500,
        textDecoration: 'none', textAlign: 'center',
      }}
    >
      Sign in →
    </Link>
  </div>
</div>
```

- [ ] **Step 7: Hero h1과 CTA 버튼에 className 추가**

h1:
```tsx
<h1 className="landing-hero-h1" style={{
  fontFamily: "'Fraunces', serif",
  fontSize: 56, ...
}}>
```

CTA 버튼 감싸는 div:
```tsx
<div className="landing-hero-cta" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 52 }}>
```

- [ ] **Step 8: How it works 각 step row에 className 추가**

`STEPS.map(...)` 내부 첫 번째 `<div>`:
```tsx
<div key={step.num} className="landing-how-row" style={{
  display: 'flex', alignItems: 'flex-start', gap: 28,
  padding: '28px 36px',
  borderBottom: i < STEPS.length - 1 ? '1px solid #f1f5f9' : 'none',
}}>
  <span ...>{step.num}</span>
  <div className="landing-how-divider" style={{ width: 1, alignSelf: 'stretch', background: '#f1f5f9', flexShrink: 0 }} />
  <div className="landing-how-title" style={{ flexShrink: 0, minWidth: 160 }}>
    ...
  </div>
  <p ...>{step.desc}</p>
</div>
```

- [ ] **Step 9: Footer에 className 추가**

```tsx
<footer className="landing-footer" style={{
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '20px 48px', ...
}}>
```

- [ ] **Step 10: 커밋**

```bash
git add frontend/src/pages/LandingPage.tsx
git commit -m "feat: 모바일 햄버거 메뉴 추가 및 Landing 반응형 className 적용"
```

---

### Task 3: HomePage — 옵션 그리드 반응형

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: simulation 탭 그리드 div에 className 추가**

`optionsTab === 'simulation'` 블록 내 (line ~275):
```tsx
<div className="options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
```

- [ ] **Step 2: research 탭 그리드 div에 className 추가**

`optionsTab === 'research'` 블록 내 (line ~351):
```tsx
<div className="options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/HomePage.tsx
git commit -m "style: HomePage 옵션 그리드 모바일 반응형 className 추가"
```

---

### Task 4: ResultPage — verdict 카드 + 탭 반응형

**Files:**
- Modify: `frontend/src/pages/ResultPage.tsx`

- [ ] **Step 1: verdict 카드 div에 className 추가**

line ~64 (`v &&` 블록 내):
```tsx
<div className="result-verdict-card" style={{
  padding: '12px 18px', borderRadius: 10, marginBottom: 20,
  border: `1px solid ${v.color}30`, background: `${v.color}08`,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}}>
```

- [ ] **Step 2: 탭 바 div에 className 추가**

line ~90:
```tsx
<div className="result-tabs" style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e2e8f0' }}>
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/ResultPage.tsx
git commit -m "style: ResultPage verdict 카드 + 탭 모바일 반응형 className 추가"
```

---

### Task 5: SimulatePage — sourcing 2열 레이아웃 반응형

**Files:**
- Modify: `frontend/src/pages/SimulatePage.tsx`

- [ ] **Step 1: isSourcing 조건의 `<main>`에 className 추가**

line ~243:
```tsx
<main className="page-enter sim-sourcing-layout" style={{
  maxWidth: 1600, margin: '0 auto', padding: '16px 24px',
  display: 'flex', gap: 24, alignItems: 'flex-start',
}}>
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/pages/SimulatePage.tsx
git commit -m "style: SimulatePage sourcing 레이아웃 모바일 반응형 className 추가"
```

---

### Task 6: HistoryPage — 아이템 행 반응형

**Files:**
- Modify: `frontend/src/pages/HistoryPage.tsx`

- [ ] **Step 1: 아이템 내부 row div에 className 추가**

line ~110:
```tsx
<div className="history-item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
```

- [ ] **Step 2: 버튼 그룹 div에 className 추가**

line ~114:
```tsx
<div className="history-item-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/HistoryPage.tsx
git commit -m "style: HistoryPage 아이템 행 모바일 반응형 className 추가"
```

---

## 검증 방법

각 Task 완료 후 브라우저 DevTools → 모바일 에뮬레이션(iPhone SE: 375px, 또는 320px 최소)으로 확인:

- Task 2 완료 후: 랜딩 페이지 nav 햄버거 메뉴 열리고 닫힘, h1 크기, how it works 세로 스택
- Task 3 완료 후: `/app` 페이지 Advanced Options 열었을 때 1열 그리드
- Task 4 완료 후: `/result/:id` 페이지 verdict 카드 세로 스택, 탭 가로 스크롤
- Task 5 완료 후: 시뮬레이션 진행 중 소싱 단계에서 그래프+피드 세로 스택
- Task 6 완료 후: History 페이지 아이템 행 세로 스택
