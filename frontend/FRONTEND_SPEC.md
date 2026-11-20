`) как `frontend/FRONTEND_SPEC.md`.
3. Полностью реализуй Frontend в папке `frontend/` строго по этой спецификации. Если что-то расходится — спецификация главнее.
4. Закоммить результат в ветку `frontend` небольшими осмысленными коммитами и открой Pull Request в `main` (или, если нет доступа к PR, оставь всё в ветке `frontend`).

## Жёсткие ограничения
- Не создавай, не изменяй и не удаляй `backend/` и `telegram-bot/` (даже если они появятся в репозитории).
- В корне репозитория меняй только то, что необходимо: допустимо дополнить `.gitignore` (добавить `.env`, `node_modules`, `dist`) и ничего не удалять из `README.md`.
- Не создавай Backend внутри Frontend.
- **Не создавай фальшивый AI Matching**: никаких `Math.random`, никаких расчётов совместимости на клиенте. Процент, порядок, `reason`, `icebreaker` — только из ответа `POST /api/match`.
- Не меняй API-контракт самостоятельно; предположения по `/api/feedback`, `/api/profile/me`, `/api/telegram/link` оформи как в спецификации и перечисли в `frontend/README.md`.
- Не храни секреты в коде. Только `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, `VITE_USE_MOCK_API`. Никакого `service_role`. Пароли нигде не сохранять. Создай `frontend/.env.example`.
- Не имитируй подтверждение email. Если Supabase не настроен — явный демо-режим (анкета и рекомендации без регистрации).
- Если Backend не готов — mock API с явно помеченными демо-данными (баннер «DEMO»); отключается переменными окружения.
- Демо-данные не выдавай за реальных людей; статистику на главной помечай как цели проекта.
- Не усложняй архитектуру: React Context + хуки, без Redux.

## Порядок работы
**P0:** scaffolding (Vite + React + TS + Tailwind + Router) → дизайн-система → главная → анкета `/onboarding` (4 шага, 6 целей, теги, валидация) → API-клиент + `POST /api/match` → `/matches` (топ-5, кольцо совместимости, полное объяснение, первая фраза + копирование, состояния loading/error/empty/partial/success) → адаптив → демо-режим и mock.
**P1:** Supabase (регистрация, вход, выход, повторная отправка письма), `/verify-email`, `/profile/setup`, `/dashboard`, `/profile/edit`, три языка (ru по умолчанию, kk, en), `POST /api/feedback`.
**P2:** анимации, Telegram-привязка (или состояние «Скоро»), расширенные настройки.

Не жертвуй P0 ради дизайна.

## Проверка перед завершением
```bash
cd frontend
npm install
npm run build      # без ошибок
npm run dev        # проверить основные сценарии
```
Пройди чек-лист §14 спецификации (включая «Запреты») и убедись, что `git diff main` не затрагивает `backend/` и `telegram-bot/`.

## Что вернуть
1. Код в `frontend/`.
2. `frontend/README.md`: запуск, переменные окружения, режимы (полный/демо), как отключить mock, настройка Supabase (Redirect URL `/verify-email`), маршруты, список предположений по API.
3. Короткий итог: что сделано по P0/P1/P2, что нет, открытые вопросы к Backend (§15).

Начинай сразу, не задавай уточняющих вопросов. При неопределённости выбирай простое решение по спецификации и записывай его в README.

---

# ПОЛНАЯ СПЕЦИФИКАЦИЯ

# FRONTEND_SPEC.md — MeetMatch AI (Frontend)

> Дедлайн хакатона: **21 ноября 2026, 09:00 (Алматы)**.
> Стек: React + Vite + TypeScript + Tailwind CSS. Backend (FastAPI) и Telegram-бот (aiogram) делают другие участники — **их не трогаем**.

---

## 0. Главные принципы

1. **P0 важнее дизайна.** Порядок работы: анкета → `/api/match` → топ-5 с объяснениями → адаптив → всё остальное.
2. **Никакого фальшивого AI.** Frontend не считает совместимость, не генерирует проценты, не сортирует по собственным оценкам. Всё приходит с Backend.
3. **Контракт API не меняем.** Типы в `src/types/index.ts` — единственное место, где описан контракт. Всё, что в этом документе помечено как **[ПРЕДПОЛОЖЕНИЕ]**, нужно сверить с Backend и при необходимости поправить только в `types/` и `services/api.ts`.
4. **Честные демо-данные.** Mock/демо-режим всегда виден пользователю (баннер «DEMO»), демо-данные не выдаются за реальных людей.
5. **Секреты.** Только `VITE_*` переменные. `service_role` ключа во Frontend нет и быть не может. Пароли не сохраняются нигде (ни localStorage, ни state дольше формы).
6. **Простота.** Без Redux, без лишних библиотек. Достаточно React Context + хуки.

---

## 1. Архитектура Frontend

### 1.1 Зависимости

| Назначение | Пакет |
|---|---|
| Роутинг | `react-router-dom` (v6+) |
| Стили | `tailwindcss`, `postcss`, `autoprefixer` |
| Иконки | `lucide-react` |
| Auth | `@supabase/supabase-js` |
| i18n | собственный словарь + контекст (см. §10) — **без** react-i18next, чтобы не усложнять |
| HTTP | нативный `fetch` в обёртке `services/api.ts` (без axios) |
| Анимации | CSS-анимации Tailwind; `framer-motion` — опционально, только для появления карточек матчей |

### 1.2 Структура проекта (внутри существующего репозитория)

```
MeetMatchAi/
  backend/            ← НЕ ТРОГАТЬ
  telegram-bot/       ← НЕ ТРОГАТЬ
  frontend/
    src/
      components/
        Navbar.tsx
        Footer.tsx
        MatchCard.tsx
        ProfileForm.tsx
        GoalSelector.tsx
        LoadingState.tsx
        TagInput.tsx
        ProgressSteps.tsx
        CompatibilityRing.tsx
        DemoBanner.tsx
        ErrorState.tsx
        EmptyState.tsx
        LanguageSwitcher.tsx
        ProtectedRoute.tsx
        ui/               (Button.tsx, Input.tsx, Card.tsx, Select.tsx, Textarea.tsx, Toast.tsx)
      pages/
        Home.tsx
        Login.tsx
        Register.tsx
        VerifyEmail.tsx
        ProfileSetup.tsx
        Onboarding.tsx
        Matches.tsx
        Dashboard.tsx
        EditProfile.tsx
        NotFound.tsx
      services/
        api.ts            (HTTP-клиент + ApiError)
        mockApi.ts        (демо-реализация, явно помечена)
        supabase.ts
      types/
        index.ts
      i18n/
        translations.ts
        I18nContext.tsx
      hooks/
        useAuth.ts
        useI18n.ts
        useOnboardingDraft.ts
        useMatches.ts
      contexts/
        AuthContext.tsx
        MatchesContext.tsx
      lib/
        validation.ts
        goals.ts          (список целей + иконки)
        env.ts            (чтение и проверка VITE_*)
      styles/
        index.css
      App.tsx
      main.tsx
    public/
      favicon.svg
    index.html
    package.json
    vite.config.ts
    tsconfig.json
    tailwind.config.ts
    postcss.config.js
    .env.example
    README.md
```

> Если `frontend/` уже существует в репозитории — **дополнить**, а не пересоздавать. Существующие файлы не удалять без необходимости.

### 1.3 Переменные окружения (`.env.example`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:8000
# true — использовать mock API (демо-данные). По умолчанию true, если VITE_API_BASE_URL пуст.
VITE_USE_MOCK_API=false
```

`lib/env.ts` экспортирует:

```ts
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "",
  useMockApi:
    import.meta.env.VITE_USE_MOCK_API === "true" ||
    !import.meta.env.VITE_API_BASE_URL,
};
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isDemoAuthMode = !isSupabaseConfigured;
```

### 1.4 Режимы работы

| Supabase | Backend | Поведение |
|---|---|---|
| настроен | настроен | Полный режим |
| настроен | не готов (`useMockApi`) | Auth реальный, матчи из mock + баннер «DEMO» |
| не настроен | настроен | **Демо-режим без регистрации**: `/onboarding` и `/matches` доступны без входа; реальный `/api/match` |
| не настроен | не настроен | Демо-режим + mock API; везде баннер |

В демо-режиме auth-страницы (`/register`, `/login`, `/verify-email`) показывают понятное сообщение «Авторизация не настроена. Вы можете пройти анкету в демонстрационном режиме» + кнопку на `/onboarding`. **Никогда** не имитировать успешную регистрацию или подтверждённый email.

---

## 2. Дизайн-система

### 2.1 Токены (Tailwind `theme.extend`)

```ts
colors: {
  bg:        { DEFAULT: "#0B1020", soft: "#0F1630", card: "#131B3A", elevated: "#1A2347" },
  border:    { DEFAULT: "#26305A", strong: "#34407A" },
  primary:   { DEFAULT: "#7C5CFF", hover: "#6B49F5", soft: "#7C5CFF1A" },   // фиолетовый
  accent:    { DEFAULT: "#38BDF8", hover: "#22A9E6", soft: "#38BDF81A" },    // голубой
  text:      { DEFAULT: "#E6EAF7", muted: "#98A2C7", faint: "#6B7499" },
  success:   "#34D399",
  warning:   "#FBBF24",
  danger:    "#F87171",
},
borderRadius: { xl: "14px", "2xl": "20px", "3xl": "28px" },
boxShadow: {
  glow: "0 0 40px -10px rgba(124,92,255,0.45)",
  card: "0 8px 30px -12px rgba(0,0,0,0.6)",
},
backgroundImage: {
  "brand-gradient": "linear-gradient(135deg,#7C5CFF 0%,#38BDF8 100%)",
  "hero-glow": "radial-gradient(60% 50% at 50% 0%, rgba(124,92,255,0.25) 0%, rgba(11,16,32,0) 70%)",
},
fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
```

- Шрифт: Inter (Google Fonts или системный fallback). Размеры: заголовок Hero `text-4xl md:text-6xl font-bold`, H2 `text-2xl md:text-4xl`, текст `text-base`, подписи `text-sm text-text-muted`.
- Фон страницы: `bg-bg text-text`, поверх Hero — `bg-hero-glow`.
- Основная кнопка: `bg-brand-gradient`, `rounded-xl`, `px-5 py-3`, hover — лёгкое увеличение яркости + `shadow-glow`. Вторичная: прозрачная с `border-border`.
- Карточки: `bg-bg-card border border-border rounded-2xl shadow-card`.
- Input: `bg-bg-soft border-border rounded-xl focus:ring-2 focus:ring-primary`; состояние ошибки — `border-danger` + текст ошибки под полем.
- Тёмная тема — единственная (переключатель темы не нужен).

### 2.2 Анимации (умеренно)

- Появление карточек матчей: stagger 80 мс, `opacity 0→1`, `translateY 12px→0`, 350 мс.
- Круговой индикатор совместимости: анимация заполнения 700 мс.
- Hover карточек: `translateY(-2px)` + усиление границы.
- Переход между шагами анкеты: fade/slide 200 мс.
- Обязательно уважать `prefers-reduced-motion` (отключать анимации).
- Никаких бесконечных декоративных анимаций, кроме спиннера и skeleton-shimmer.

### 2.3 Доступность

- Контраст текста ≥ 4.5:1, видимый focus-ring, `aria-label` у иконочных кнопок, `aria-live="polite"` для сообщений об ошибках/успехе, у карточек целей — `role="radio"` внутри `role="radiogroup"`.

---

## 3. Структура страниц и маршрутизация

### 3.1 Таблица маршрутов

| Путь | Страница | Доступ |
|---|---|---|
| `/` | Home | публичный |
| `/register` | Register | только гости (авторизованных → `/dashboard`) |
| `/login` | Login | только гости |
| `/verify-email` | VerifyEmail | публичный |
| `/profile/setup` | ProfileSetup | авторизован + email подтверждён |
| `/onboarding` | Onboarding | авторизован **или** демо-режим |
| `/matches` | Matches | авторизован **или** демо-режим |
| `/dashboard` | Dashboard | авторизован |
| `/profile/edit` | EditProfile | авторизован |
| `*` | NotFound | публичный |

### 3.2 Логика `ProtectedRoute`

```
если isDemoAuthMode и маршрут ∈ {/onboarding, /matches}  → пропустить
если auth loading                                         → <LoadingState/>
если нет сессии                                           → redirect /login (сохранить from)
если email не подтверждён (user.email_confirmed_at пуст)  → redirect /verify-email
иначе                                                     → children
```

### 3.3 Основной пользовательский поток

```
/  → Sign Up → /register → письмо → ссылка → /verify-email (подтверждено)
   → /profile/setup → /onboarding → /matches → /dashboard
```

После подтверждения email Supabase возвращает пользователя на `emailRedirectTo = ${window.location.origin}/verify-email`. Страница `/verify-email` проверяет сессию; при подтверждённом email показывает «Email подтверждён» и кнопку «Продолжить» → `/profile/setup`.

CTA «Find Your Match» на главной: в демо-режиме или при наличии сессии → `/onboarding`, иначе → `/register`.

Маршруты в `App.tsx` — через `createBrowserRouter` или `<Routes>`; страницы подгружать через `React.lazy` + `Suspense` (необязательно, но желательно для скорости).

---

## 4. Страницы — подробно

### 4.1 Главная `/`

Секции сверху вниз:

1. **Navbar**: логотип «MeetMatch AI» (иконка + градиентный текст), ссылки-якоря (How It Works, Features), `LanguageSwitcher`, кнопки Login / Sign Up. На мобильных — бургер-меню. Для авторизованных вместо Login/Sign Up: Dashboard + Logout.
2. **Hero**: заголовок **«Meet the right people. Build the future.»** (текст заголовка не переводится или переводится — по словарю, ключ `home.hero.title`; английская версия обязана быть именно такой), подзаголовок (1–2 строки о платформе), кнопка **«Find Your Match»**, вторичная кнопка «How it works» (скролл).
3. **Статистика** (3 плашки): `150+ demo profiles`, `5 smart matches`, `Under 3 seconds`. Под плашками мелкая подпись: «Цели проекта и демонстрационные данные, не реальные показатели». Это обязательно.
4. **How It Works**: 3 шага с иконками — (1) Заполните анкету (~2 мин), (2) AI подбирает 5 людей, (3) Знакомьтесь с готовой первой фразой.
5. **Преимущества AI Matching**: 4 карточки — учёт навыков, интересов, опыта, **взаимность целей**; объяснение каждой рекомендации.
6. **Пример карточек рекомендаций**: 2–3 статические карточки `MatchCard` в режиме `variant="sample"` с заметным ярлыком «Пример / Demo». Данные — вымышленные, имена явно демо.
7. **Возможности платформы**: сетка (6 цифровых карточек): анкета за 2 минуты, топ-5, объяснения, первая фраза, Telegram (пометка «Скоро»), 3 языка.
8. **Footer**: логотип, ссылки, переключатель языка, «Хакатон-проект», год.

### 4.2 Регистрация `/register`

Поля: Email, Пароль, Подтверждение пароля. Кнопка «Зарегистрироваться» (disabled при loading). Ссылка на `/login`.

Валидация: email по regex; пароль ≥ 8 символов (минимум 1 буква и 1 цифра); пароли совпадают. Ошибки — под полями.

Действие: `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`. Успех → `navigate('/verify-email', { state: { email } })` с экраном «Мы отправили письмо на … Проверьте почту».

Ошибки Supabase маппить на понятные тексты (уже зарегистрирован, слабый пароль, rate limit, сеть) через i18n-ключи; неизвестная ошибка → общий текст.

### 4.3 Вход `/login`

Email + пароль. `supabase.auth.signInWithPassword`. Ошибка «Email not confirmed» → показать сообщение и кнопку «Отправить письмо повторно». После входа: если профиль не заполнен → `/profile/setup`, иначе `/dashboard` (или `from`).

### 4.4 Подтверждение email `/verify-email`

Состояния:
- ожидает подтверждения (есть email из state/сессии, `email_confirmed_at` нет): текст + кнопка **«Отправить письмо повторно»** (`supabase.auth.resend({ type: 'signup', email })`) с таймером-кулдауном 60 сек;
- подтверждён: зелёная галочка + «Продолжить» → `/profile/setup`;
- ошибка/ссылка устарела: сообщение + повторная отправка;
- Supabase не настроен: информационное сообщение демо-режима.

Подписка на `onAuthStateChange` — реагирует на подтверждение (возврат по ссылке).

### 4.5 Личный профиль `/profile/setup`

Индикатор прогресса: «Шаг 1 из 2 — Личные данные» (второй шаг — анкета).

Поля:

| Поле | Правила |
|---|---|
| ФИО | обязательно, 2–100 символов, минимум 2 слова не требовать (учесть мононимы) |
| Возраст | обязательно, целое, 16–100 |
| Пол | необязательно: `male` / `female` / `prefer_not_to_say` (по умолчанию «Не указывать») |
| Город | обязательно, 2–80 символов |
| Email | read-only, из Supabase, бейдж «Подтверждён» (только если `email_confirmed_at`) |
| Телефон | обязательно, формат E.164-подобный: `^\+?[0-9\s\-()]{10,18}$`, нормализовать пробелы |

Под блоком контактов текст: «Контакты не показываются другим участникам автоматически».

Кнопка «Продолжить»: `PUT /api/profile/me` → `/onboarding`. Если Backend недоступен/mock — данные сохраняются в mock-хранилище (память) и показывается DemoBanner; **не** класть телефон/ФИО в localStorage в реальном режиме.

### 4.6 Профессиональная анкета `/onboarding`

Пошаговая форма, 4 шага (чтобы уложиться в 2 минуты):

| Шаг | Поля |
|---|---|
| 1. Роль и опыт | Role (текст, 2–80), Experience (число лет, 0–60, степпер +/−) |
| 2. Навыки и интересы | Stack (теги, 1–15), Interests (теги, 1–10) |
| 3. О себе | About (textarea, 10–500 символов, счётчик) |
| 4. Цель | Goal — 6 карточек с иконками и описаниями |

- `ProgressSteps` сверху: шаги + процент; кнопки **«Назад» / «Далее»**; на шаге 4 вместо «Далее» — **«Find My Matches»**.
- «Далее» блокируется (или показывает ошибки) при невалидных обязательных полях. Все поля обязательны.
- Данные сохраняются при переходе между шагами и при перезагрузке страницы: `useOnboardingDraft` пишет **черновик анкеты** в `sessionStorage` (ключ `meetmatch.onboarding.draft`). Допустимо, т.к. нет паролей и секретов. Очищать черновик после успешного получения матчей — **не** очищать (нужен для повторного подбора и дашборда); очищать при выходе из аккаунта.
- Теги (`TagInput`): добавление по Enter / запятой / кнопке «+»; удаление по клику на ×/Backspace на пустом поле; без дубликатов (case-insensitive), trim, длина тега ≤ 30; под полем — подсказки-популярные теги (React, Python, AI, Startups, Product, Design, DevOps, Data…), клик добавляет тег.
- **Цели** (`GoalSelector`) — ровно 6, значения `value` строго как в контракте:

| value | RU | KZ | EN | Иконка (lucide) |
|---|---|---|---|---|
| `find_job` | Найти работу | Жұмыс табу | Find a job | `Briefcase` |
| `hire` | Нанять специалиста | Маман жалдау | Hire a specialist | `UserPlus` |
| `find_mentor` | Найти ментора | Тәлімгер табу | Find a mentor | `GraduationCap` |
| `be_mentor` | Стать ментором | Тәлімгер болу | Become a mentor | `Compass` |
| `find_cofounder` | Найти кофаундера | Кофаундер табу | Find a co-founder | `Rocket` |
| `exchange_experience` | Обмен опытом | Тәжірибе алмасу | Exchange experience | `Repeat` |

  Каждая карточка: иконка, название, описание в 1 строку (i18n). Выбранная — рамка `primary` + `shadow-glow` + галочка. Сетка: 1 колонка (моб.), 2 (планшет), 3 (десктоп).
- Финальная кнопка: собирает `MatchRequest`, вызывает `POST /api/match`, переходит на `/matches` (результат передаётся через `MatchesContext`; при прямом заходе на `/matches` без результата — редирект на `/onboarding`, если нет черновика, либо автоматический запрос по черновику).

### 4.7 Рекомендации `/matches`

- Заголовок «Ваши AI-рекомендации», подзаголовок: «Найдено за {processing_ms} мс» — **только** если Backend вернул `processing_ms`; значение не вычисляется и не подменяется на Frontend.
- Сетка карточек `MatchCard`: 1 колонка (моб.), 2 (планшет), одна колонка на широкой ленте или 2–3 в сетке — на усмотрение дизайна; главное, чтобы 5 карточек читались без горизонтального скролла.
- Порядок карточек = порядок из ответа Backend. Дополнительно не сортировать.
- Состояния (каждое — отдельный компонент/ветка):

| Состояние | Отображение |
|---|---|
| `loading` | `LoadingState`: 5 skeleton-карточек + текст «Подбираем людей…» |
| `error` | `ErrorState`: человекочитаемое сообщение, кнопки «Повторить» и «Назад к анкете» |
| `empty` (0 матчей) | `EmptyState`: «Подходящих участников пока нет», подсказка расширить интересы/навыки, кнопка «Изменить анкету» |
| `partial` (1–4) | Показать найденные + плашка «Найдено N из 5 участников» |
| `success` (5) | Карточки с анимацией появления |

- Баннер «DEMO» поверх списка, если ответ пришёл из mock API.
- Блок «Обновить рекомендации»: кнопка повторного запроса с теми же данными анкеты; после «Не подошло» — предложение «Обновить рекомендации?» (тост/плашка с кнопкой).

### 4.8 `MatchCard`

Содержимое:

- Аватар-инициалы (градиентный круг; **не** загружаем фото), имя, роль.
- `CompatibilityRing` — круговой индикатор процента (`score`, 0–100, значение из Backend без изменений; не округлять иначе чем `Math.round` для отображения, если приходит дробное).
- Бейдж цели участника (`goal`) с иконкой и названием на текущем языке.
- Блок «Почему вы подходите» — `reason` **полностью**, без обрезки и без `line-clamp`.
- Блок «Первая фраза» — `icebreaker`, в «цитатном» оформлении, кнопка **«Копировать»** (`navigator.clipboard.writeText`, fallback через `textarea` + `execCommand`; после копирования иконка меняется на галочку на 2 сек + тост).
- Кнопки: **«Познакомились»** (positive) и **«Не подошло»** (negative).

Поведение кнопок обратной связи:
- клик → `POST /api/feedback`; кнопки на время запроса disabled со спиннером;
- успех → карточка переходит в состояние `met` (зелёная метка «Отмечено») или `rejected` (приглушена, `opacity-60`, можно отменить нельзя — см. контракт); обе кнопки блокируются;
- ошибка → тост с ошибкой, кнопки снова активны;
- после `rejected` показывается предложение обновить рекомендации (один раз за сессию подбора).

### 4.9 Dashboard `/dashboard`

Вкладки/секции (боковое меню на десктопе, табы на мобильных):

1. **Мой профиль** — личные данные из `GET /api/profile/me`, статус email, кнопка «Редактировать» → `/profile/edit`.
2. **Моя профессиональная анкета** — данные из последнего черновика/профиля (Role, Stack, Experience, Interests, About, Goal), кнопка «Изменить анкету» → `/onboarding`.
3. **Мои рекомендации** — последние полученные матчи из `MatchesContext`; если нет — CTA «Подобрать людей».
4. **Изменить цель знакомства** — `GoalSelector` + «Сохранить и подобрать заново».
5. **Настройки аккаунта** — язык, выход, (опционально) смена пароля через Supabase.
6. **Подключить Telegram** — см. §8.

Дополнительно:
- **Статус заполнения профиля**: прогресс-бар, процент считается **локально из заполненности полей формы** (это не статистика знакомств и допустимо). Список недостающих полей.
- Кнопка **«Повторный AI-подбор»** — отправляет `POST /api/match` с текущей анкетой и ведёт на `/matches`.
- **Запрещено** показывать вымышленную статистику знакомств («вы познакомились с 12 людьми» и т.п.), пока Backend не предоставляет такие данные. Если в `GET /api/profile/me` придут поля статистики — показать, иначе блок скрыт.

### 4.10 Редактирование профиля `/profile/edit`

Те же поля и валидация, что в `/profile/setup`, предзаполненные из `GET /api/profile/me`. Сохранение: `PUT /api/profile/me`. После успеха — тост «Сохранено» и возврат на `/dashboard`. Предупреждение при уходе с несохранёнными изменениями — желательно (P2).

### 4.11 NotFound

Короткая страница 404 с кнопкой «На главную».

---

## 5. Компоненты React

| Компонент | Props (основные) | Назначение |
|---|---|---|
| `Navbar` | — | Навигация, язык, кнопки auth, бургер на мобильных |
| `Footer` | — | Подвал |
| `LanguageSwitcher` | — | RU / KZ / EN, сохраняет выбор в `localStorage('meetmatch.lang')` |
| `DemoBanner` | `reason: "auth" \| "api"` | Жёлтая/голубая полоса «Демонстрационный режим» |
| `ProgressSteps` | `steps: string[]`, `current: number` | Индикатор прогресса |
| `ProfileForm` | `initial?`, `onSubmit`, `submitLabel`, `loading` | Форма личных данных (используется в Setup и Edit) |
| `TagInput` | `value: string[]`, `onChange`, `max`, `suggestions?`, `placeholder`, `error?` | Теги |
| `GoalSelector` | `value: Goal \| null`, `onChange` | 6 карточек целей |
| `CompatibilityRing` | `score: number`, `size?` | Круговой индикатор |
| `MatchCard` | `match: Match`, `onFeedback`, `status`, `variant?: "live" \| "sample"` | Карточка рекомендации |
| `LoadingState` | `variant: "page" \| "matches"`, `label?` | Спиннер/skeleton |
| `ErrorState` | `title`, `message`, `onRetry?`, `actions?` | Ошибка |
| `EmptyState` | `title`, `message`, `action?` | Пусто |
| `ProtectedRoute` | `children`, `allowDemo?` | Защита маршрутов |
| `ui/*` | стандартные | Button (variants: primary / secondary / ghost / danger, `loading`), Input, Textarea, Select, Card, Toast |

Хуки и контексты:

- `AuthContext` / `useAuth()` → `{ user, session, loading, isConfigured, signUp, signIn, signOut, resendConfirmation }`.
- `I18nContext` / `useI18n()` → `{ lang, setLang, t }`.
- `MatchesContext` / `useMatches()` → `{ status, matches, processingMs, isDemo, error, fetchMatches(request), sendFeedback(matchId, action), reset }`.
- `useOnboardingDraft()` → `{ draft, update, clear, isValidStep(n) }`.

---

## 6. TypeScript-интерфейсы (`src/types/index.ts`)

```ts
// ===== Цели =====
export const GOALS = [
  "find_job",
  "hire",
  "find_mentor",
  "be_mentor",
  "find_cofounder",
  "exchange_experience",
] as const;
export type Goal = (typeof GOALS)[number];

// ===== /api/match (контракт из ТЗ) =====
export interface MatchRequest {
  role: string;
  stack: string[];
  experience: number;       // годы
  interests: string[];
  about: string;
  goal: Goal;
}

export interface Match {
  id: string;               // например "user_042"
  name: string;
  role: string;
  score: number;            // 0–100, считает Backend
  goal: Goal;               // цель участника-рекомендации
  reason: string;           // 1–2 предложения
  icebreaker: string;       // первая фраза
}

export interface MatchResponse {
  matches: Match[];         // до 5 элементов
  processing_ms: number;
}

// ===== /api/feedback =====
// [ПРЕДПОЛОЖЕНИЕ] Схема не зафиксирована в ТЗ. Сверить с Backend (Pydantic).
export type FeedbackAction = "met" | "not_fit";

export interface FeedbackRequest {
  match_id: string;
  action: FeedbackAction;
}

export interface FeedbackResponse {
  ok: boolean;
}

// ===== /api/profile/me =====
// [ПРЕДПОЛОЖЕНИЕ] Схема не зафиксирована в ТЗ. Сверить с Backend.
export type Gender = "male" | "female" | "prefer_not_to_say";

export interface PersonalProfile {
  full_name: string;
  age: number;
  gender: Gender | null;
  city: string;
  phone: string;
}

export interface ProfessionalProfile extends MatchRequest {}

export interface ProfileMe {
  email?: string;
  personal?: PersonalProfile;
  professional?: ProfessionalProfile;
  // Статистика — только если Backend её отдаёт; Frontend ничего не выдумывает.
  stats?: Record<string, number>;
}

// ===== /api/telegram/link =====
// [ПРЕДПОЛОЖЕНИЕ] Одноразовый код привязки. Сверить с Backend.
export interface TelegramLinkResponse {
  code: string;
  deep_link?: string;       // t.me/<bot>?start=<code> — только одноразовый код, без токенов
  expires_in?: number;      // секунды
}

// ===== /api/health =====
export interface HealthResponse {
  status: string;
}

// ===== Ошибки =====
export class ApiError extends Error {
  constructor(
    public status: number,       // 0 — сетевая ошибка/таймаут
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

// ===== UI-состояния =====
export type MatchesStatus = "idle" | "loading" | "success" | "partial" | "empty" | "error";
export type MatchCardStatus = "idle" | "sending" | "met" | "rejected";
export type Lang = "ru" | "kk" | "en";
```

Правило: если Pydantic-схема Backend отличается — **подгоняем типы под Backend**, а не наоборот.

---

## 7. Формы и валидация

Единый модуль `lib/validation.ts` — чистые функции, возвращающие ключ ошибки i18n (или `null`). Библиотеки (zod/react-hook-form) — по желанию, не обязательны.

| Правило | Реализация |
|---|---|
| email | `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` |
| пароль | длина ≥ 8, есть буква и цифра |
| подтверждение пароля | равно паролю |
| ФИО | trim, 2–100 символов |
| возраст | целое число, 16–100 |
| город | trim, 2–80 |
| телефон | `/^\+?[0-9\s\-()]{10,18}$/` и ≥ 10 цифр после очистки |
| role | trim, 2–80 |
| experience | целое/десятичное число 0–60 |
| stack | 1–15 тегов |
| interests | 1–10 тегов |
| about | 10–500 символов |
| goal | одно из `GOALS` |

Принципы UX форм:
- ошибки показываются после `blur` или попытки отправки, не при первом вводе;
- кнопка отправки показывает `loading`; двойная отправка блокируется;
- trim всех строк перед отправкой; в `stack`/`interests` — без дубликатов;
- `about`: счётчик символов `N/500`;
- клавиатура: Enter в `TagInput` не отправляет форму.

---

## 8. Авторизация Supabase

`services/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "../lib/env";

export const supabase = isSupabaseConfigured
  ? createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
```

`AuthContext`:
- при монтировании: `supabase.auth.getSession()` + подписка `onAuthStateChange`; `loading=true` до первого ответа;
- `signUp`, `signIn`, `signOut`, `resendConfirmation(email)`;
- `signOut` также очищает черновик анкеты и контекст матчей;
- если `supabase === null` → `isConfigured=false`, методы auth бросают понятную ошибку, UI показывает демо-режим.

Требования безопасности:
- пароль живёт только в state формы и уходит только в Supabase SDK; не логировать, не писать в storage;
- токены хранит SDK Supabase (его собственное хранилище) — вручную в localStorage не дублировать;
- `service_role` во Frontend запрещён;
- access token отправляется на Backend заголовком `Authorization: Bearer <token>` для запросов, где есть сессия (см. §9). Если Backend не проверяет токен — заголовок безвреден.

Telegram deep link **никогда** не содержит пароль или access token — только одноразовый код от Backend.

---

## 9. API-контракт и клиент

### 9.1 Endpoints

| Метод | Путь | Тело | Ответ | Статус контракта |
|---|---|---|---|---|
| GET | `/api/health` | — | `HealthResponse` | предположение |
| POST | `/api/match` | `MatchRequest` | `MatchResponse` | **зафиксирован** |
| POST | `/api/feedback` | `FeedbackRequest` | `FeedbackResponse` | предположение |
| GET | `/api/profile/me` | — | `ProfileMe` | предположение |
| PUT | `/api/profile/me` | `ProfileMe` (или его часть) | `ProfileMe` | предположение |
| POST | `/api/telegram/link` | — | `TelegramLinkResponse` | предположение |

### 9.2 `services/api.ts`

Требования:
- базовый URL из `env.apiBaseUrl` (без завершающего `/`);
- общая функция `request<T>(path, { method, body, auth })`: JSON, `Content-Type`, таймаут через `AbortController` (по умолчанию 15 сек; для `/api/match` — 10 сек), разбор ошибок в `ApiError` (читать `detail` из FastAPI: строка или массив валидации);
- при наличии Supabase-сессии добавлять `Authorization: Bearer <access_token>`;
- сетевые ошибки → `ApiError(0, ...)`;
- экспорт: `api.health()`, `api.match(req)`, `api.feedback(req)`, `api.getProfile()`, `api.updateProfile(p)`, `api.linkTelegram()`;
- **runtime-проверка формы ответа `/api/match`**: `matches` — массив, у каждого элемента есть `id`, `name`, `role`, `score`, `reason`, `icebreaker`; невалидные элементы отбрасываются с `console.warn`; если ответ не соответствует структуре — `ApiError` «Некорректный ответ сервера»;
- **переключатель mock**: в начале файла `const impl = env.useMockApi ? mockApi : realApi; export const api = impl;`. Для отключения mock достаточно задать `VITE_API_BASE_URL` и `VITE_USE_MOCK_API=false`. Больше ничего менять не нужно.

CORS: настраивается на Backend; Frontend в dev-режиме может использовать proxy в `vite.config.ts` (`/api` → `VITE_API_BASE_URL`) — опционально, если CORS мешает.

### 9.3 `services/mockApi.ts` (демо)

- Файл начинается с комментария `// DEMO ONLY — не реальный AI-подбор`.
- `match()`: имитирует задержку 400–800 мс и возвращает **фиксированный набор** из 5 явно демонстрационных профилей (имена вроде «Демо-профиль А. (IT Recruiter)»). **Не** вычисляет `score` на основе введённых данных, **не** сортирует по релевантности: набор статичен. В ответ добавляется внутренний флаг `__demo: true`, по которому UI показывает `DemoBanner`.
- `feedback()`, `getProfile()`, `updateProfile()` работают на in-memory хранилище; `linkTelegram()` бросает `ApiError(501, "not implemented")`.
- Код mock изолирован: удаление файла + одна строка импорта не ломает сборку.

### 9.4 Привязка Telegram

- Раздел «Подключить Telegram» в Dashboard.
- При старте страницы можно один раз проверить `api.health()` / попытаться `POST /api/telegram/link` только по нажатию кнопки.
- Если Backend вернул 404/501/сетевая ошибка при нажатии, либо работает mock → показывать состояние **«Скоро»** (бейдж, неактивный блок с пояснением) вместо ошибки. До нажатия кнопка отображается, только если известно, что endpoint готов; иначе — сразу «Скоро». Практичное правило: если `env.useMockApi` → «Скоро»; иначе кнопка активна, а ответ 404/501 переводит блок в «Скоро».
- Успех: показать одноразовый код и/или кнопку «Открыть Telegram» (`deep_link`), таймер действия кода (`expires_in`), инструкцию «Отправьте код боту». Никаких токенов в ссылке.

---

## 10. Мультиязычность

- Языки: `ru` (по умолчанию), `kk`, `en`. Выбор хранится в `localStorage('meetmatch.lang')`; `document.documentElement.lang` обновляется.
- `i18n/translations.ts` — один объект `Record<Lang, Dict>`; `Dict` — плоский словарь ключей вида `section.key`. Тип ключей выводится из `ru`-словаря (`typeof ru`), чтобы TypeScript ловил пропущенные ключи в `kk` и `en`.
- `t(key, params?)` — подстановка `{name}`-параметров; fallback: текущий язык → `ru` → ключ.
- Переводится **всё**: кнопки, лейблы, плейсхолдеры, ошибки, валидация, состояния, цели, тосты, описания Hero и секций.
- Не переводятся: название бренда, значения контракта (`find_job` и т.д.), пользовательский контент с Backend (`name`, `role`, `reason`, `icebreaker` — отображаются как пришли).
- Пример ключей (минимум для P0): `nav.login`, `nav.signup`, `home.hero.title`, `home.hero.cta`, `onboarding.step1.title`, `onboarding.next`, `onboarding.back`, `onboarding.submit`, `goals.find_job.title`, `goals.find_job.desc` (×6), `matches.title`, `matches.loading`, `matches.empty`, `matches.partial`, `matches.copy`, `matches.met`, `matches.notFit`, `matches.refresh`, `errors.network`, `errors.server`, `errors.invalid`, `common.retry`, `demo.banner`.
- Для `kk` допускается отметить непроверенные переводы комментарием `// TODO: review by native speaker`, но ключи должны быть заполнены (не пустые строки).

Заголовок Hero (EN): **Meet the right people. Build the future.**; RU: «Встречайте нужных людей. Создавайте будущее.»; KK: «Дұрыс адамдармен танысыңыз. Болашақты бірге құрыңыз.»

---

## 11. Обработка ошибок

| Ситуация | Поведение |
|---|---|
| Сеть / таймаут (`status 0`) | «Не удаётся связаться с сервером» + «Повторить» |
| 4xx с `detail` | Показать понятный текст; технические детали — в консоль |
| 422 (валидация Backend) | Общая ошибка + подсветка полей, если `detail[].loc` сопоставим с полями |
| 5xx | «Сервер временно недоступен. Попробуйте ещё раз» |
| 401/403 | Выход из сессии (если Supabase) → `/login` |
| Пустой/невалидный ответ `/api/match` | `ErrorState` «Некорректный ответ сервера» |
| 0 матчей | `EmptyState` (не ошибка) |
| < 5 матчей | `partial`, не ошибка |
| Ошибка feedback | Тост, повтор возможен |
| Clipboard недоступен | Fallback, при провале — тост «Скопируйте вручную» и выделение текста |
| Ошибки Supabase | Маппинг на i18n-ключи; неизвестные — общий текст |
| Необработанная ошибка рендера | `ErrorBoundary` в корне с кнопкой «Перезагрузить» |

Дополнительно:
- Пользователь никогда не видит stack trace, JSON и сырые английские тексты исключений.
- Индикаторы загрузки на всех асинхронных действиях.
- Двойные клики блокируются.

---

## 12. Адаптивность

Брейкпоинты Tailwind: `sm 640`, `md 768`, `lg 1024`, `xl 1280`. Mobile-first.

| Элемент | Моб. (<640) | Планшет (640–1023) | Десктоп (≥1024) |
|---|---|---|---|
| Navbar | логотип + бургер, выдвижное меню | логотип + бургер или компактное меню | полное меню |
| Hero | 1 колонка, `text-4xl`, кнопки в столбец | 1 колонка, крупнее | заголовок `text-6xl`, кнопки в ряд |
| Статистика | 1 колонка или горизонтальный скролл-снап (без обрезки) | 3 колонки | 3 колонки |
| Анкета | 1 колонка, кнопки «Назад/Далее» закреплены снизу | центрированная карточка `max-w-2xl` | то же |
| Цели | 1 колонка | 2 колонки | 3 колонки |
| Матчи | 1 колонка | 2 колонки | 2–3 колонки |
| Dashboard | табы сверху (скролл) | табы | боковое меню + контент |

Требования: никакого горизонтального скролла страницы; тач-таргеты ≥ 44×44 px; `<meta name="viewport">`; шрифты ≥ 16px в input (чтобы iOS не зумил); проверить ширины 360, 390, 768, 1024, 1440.

---

## 13. Инструкция запуска

```bash
cd frontend
cp .env.example .env     # заполнить значения (или оставить пустыми для демо-режима)
npm install
npm run dev              # http://localhost:5173
npm run build            # production-сборка (tsc + vite build) — должна проходить без ошибок
npm run preview          # локальный просмотр сборки
```

`package.json` scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `lint` (если настроен eslint).

README.md во `frontend/` должен содержать: описание, переменные окружения, режимы (полный / демо), как отключить mock (`VITE_API_BASE_URL=...`, `VITE_USE_MOCK_API=false`), как настроить Supabase (Site URL и Redirect URL: `http://localhost:5173/verify-email` и продакшн-адрес), список маршрутов, список предположений по API-контракту.

Настройка Supabase (для README): включить Email provider и «Confirm email», добавить Redirect URL `${origin}/verify-email`.

---

## 14. Критерии готовности (Definition of Done)

### P0 — обязательно
- [ ] `npm install && npm run dev` запускает сайт без ошибок в консоли.
- [ ] `npm run build` завершается без ошибок и TypeScript-предупреждений-ошибок.
- [ ] Главная страница по §4.1: Hero-заголовок точно «Meet the right people. Build the future.», кнопка «Find Your Match», How It Works, преимущества, примеры карточек, возможности, Footer; статистика помечена как цели/демо.
- [ ] Анкета `/onboarding`: 4 шага, валидация обязательных полей, теги навыков/интересов, **все 6 целей** с корректными `value`, сохранение данных между шагами, прогресс, «Назад/Далее», «Find My Matches».
- [ ] «Find My Matches» отправляет `POST {API_BASE}/api/match` с телом точно по контракту `MatchRequest`.
- [ ] `/matches` показывает до 5 карточек из ответа Backend: имя, роль, процент (кольцо), цель, **полное** объяснение, первая фраза, кнопка копирования.
- [ ] Состояния: loading, error, empty, partial (<5), success.
- [ ] Процент и порядок берутся только из ответа Backend; в коде нет `Math.random` и расчёта совместимости.
- [ ] Адаптив на 360/768/1440 без горизонтального скролла.
- [ ] Демо-режим: при отсутствии Supabase анкета и матчи доступны без регистрации; при mock API везде виден `DemoBanner`; mock отключается переменными окружения.

### P1 — желательно
- [ ] Регистрация, вход, выход, проверка авторизации, loading/ошибки, повторная отправка письма (с кулдауном).
- [ ] `/verify-email` реагирует на подтверждение; email в профиле помечен «Подтверждён» только при реальном подтверждении.
- [ ] `/profile/setup` с валидацией (возраст 16–100, формат телефона, пол необязателен), прогресс-индикатор.
- [ ] Dashboard: разделы по §4.9, статус заполнения, повторный подбор.
- [ ] Три языка (ru по умолчанию, kk, en), переключатель работает без перезагрузки.
- [ ] Кнопки «Познакомились» / «Не подошло» отправляют `POST /api/feedback`; после отрицательной оценки предлагается обновить рекомендации.

### P2 — если останется время
- [ ] Дополнительные анимации (stagger, кольцо).
- [ ] Блок статистики Dashboard (только при наличии данных от Backend).
- [ ] Telegram-привязка (код), иначе состояние «Скоро».
- [ ] Предупреждение о несохранённых изменениях, смена пароля.

### Проверочный чек-лист (ручное тестирование)
1. Сайт открывается без ошибок в консоли.
2. Все 9 маршрутов открываются (защищённые — с корректными редиректами).
3. Регистрация: пустые поля, неверный email, короткий пароль, несовпадение паролей, «уже зарегистрирован» — понятные ошибки.
4. Email verification работает при настроенном Supabase; в демо-режиме подтверждение не имитируется.
5. Анкета не пускает дальше с пустыми обязательными полями.
6. Доступны все 6 целей, выбирается ровно одна.
7. В Network виден `POST /api/match` с правильным телом.
8. Топ-5 отображается корректно; 0 и 1–4 матча тоже обработаны.
9. `reason` показан полностью (проверить длинный текст).
10. Мобильная вёрстка корректна (360 px).
11. Переключение RU/KK/EN меняет все основные тексты.
12. `npm run build` проходит.
13. Повторный запрос, копирование фразы, feedback — работают; в сетевом запросе `Authorization` присутствует только при наличии сессии.
14. В репозитории нет ключей/секретов; `.env` в `.gitignore`.

### Запреты (проверить перед сдачей)
- Не изменялись `backend/` и `telegram-bot/`.
- Нет `service_role`, паролей и токенов в коде/localStorage.
- Нет случайных процентов и клиентских расчётов совместимости.
- Нет выдуманной статистики знакомств; демо-данные явно помечены.
- Контракт API не менялся самовольно: все предположения перечислены в README.

---

## 15. Открытые вопросы для согласования с Backend (не блокируют работу)

1. Точная схема `POST /api/feedback` (предложено: `{ match_id, action: "met" | "not_fit" }`).
2. Схемы `GET/PUT /api/profile/me` (предложено: см. §6).
3. Проверяет ли Backend Supabase JWT (заголовок `Authorization: Bearer`).
4. Формат ответа `POST /api/telegram/link` (предложено: `{ code, deep_link?, expires_in? }`).
5. Включён ли CORS для `http://localhost:5173` и боевого домена.
6. Сохраняет ли `PUT /api/profile/me` профессиональную анкету, или она живёт только в запросе `/api/match`.

По каждому пункту Frontend работает с предположением; правка делается только в `types/index.ts` и `services/api.ts`.
