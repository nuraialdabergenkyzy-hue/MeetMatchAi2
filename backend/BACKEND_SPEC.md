# MeetMatch AI — BACKEND_SPEC.md

Версия: 1.0 (хакатон) · Стек: Python 3.11+, FastAPI, SQLite + SQLAlchemy 2.0, Pydantic v2, Supabase Auth, Pytest, Docker

Backend отвечает только за каталог `backend/`. Каталоги `frontend/` и `telegram-bot/` не изменяются.

---

## 0. Цели и приоритеты

Ключевое обещание продукта: пользователь заполняет анкету и **менее чем за 3 секунды** получает **5 наиболее подходящих людей** с оценкой совместимости 0–100, объяснением и первой фразой для знакомства.

Приоритеты (реализуем строго по порядку, времени мало):

| Приоритет | Что входит |
|---|---|
| **P0 — обязательно для демо** | Генератор 150+ анкет и `profiles.json`; алгоритм matching; `GET /api/health`; `POST /api/match` (без регистрации); валидация и формат ошибок; тесты matching; Dockerfile; README |
| **P1 — обязательно по ТЗ** | Supabase Auth (проверка JWT); `GET/PUT /api/profile/me`; `POST /api/feedback`; `POST /api/telegram/link` (привязка по одноразовому коду); скрытие чужих email/телефонов; тесты безопасности |
| **P2 — если останется время** | Rate limit; `match_logs`; учёт дизлайков при повторном подборе; опциональные эмбеддинги; `DELETE /api/telegram/link` |

Правило: не переходить к следующему приоритету, пока тесты предыдущего не зелёные.

---

## 1. Архитектура Backend

```
┌──────────────┐      HTTPS + JWT (Supabase)      ┌───────────────────────────┐
│  Frontend    │ ───────────────────────────────► │                           │
│  React/Vite  │ ◄─────────────────────────────── │       FastAPI backend     │
└──────┬───────┘                                  │                           │
       │ email+password (signUp/signIn)           │  routes ─► services       │
       ▼                                          │     │         │           │
┌──────────────┐   JWT (HS256 / JWKS)             │  security   matching.py   │
│ Supabase Auth│ ◄──────── verify ─────────────── │     │      (in-memory     │
└──────────────┘                                  │     ▼        index)       │
                                                  │  SQLite (SQLAlchemy)      │
┌──────────────┐  X-Bot-Key + X-Telegram-User-Id  │  data/profiles.json       │
│ Telegram bot │ ───────────────────────────────► │                           │
│  aiogram     │                                  └───────────────────────────┘
└──────────────┘
```

Принципы:

1. **Пароли и подтверждение email обрабатывает Supabase.** Backend пароли не принимает и не хранит. Регистрацию и вход делает frontend напрямую через Supabase; backend только проверяет JWT.
2. **Matching — чистый детерминированный Python без платных API.** Индекс кандидатов строится в памяти при старте приложения (lifespan), поэтому запрос занимает миллисекунды.
3. **Источники кандидатов:** (а) синтетические анкеты из `data/profiles.json` (доступны без регистрации), (б) реальные публичные профили из SQLite (`is_public = true`, заполнена профессиональная анкета).
4. **Синхронные эндпоинты** (`def`, не `async def`) для работы с БД — FastAPI выполняет их в threadpool. Matching — CPU-лёгкий (150–1000 кандидатов).
5. **Единый формат ошибок** для всех кодов (см. раздел 4.0).
6. **Конфигурация только через переменные окружения** (`pydantic-settings`), секреты не коммитятся.

---

## 2. Структура файлов

```
backend/
  app/
    __init__.py
    main.py            # создание FastAPI, lifespan (загрузка индекса), CORS, обработчики ошибок, подключение роутов
    config.py          # Settings (pydantic-settings), чтение .env
    database.py        # engine, SessionLocal, Base, get_db, init_db()
    models.py          # SQLAlchemy ORM: User, Profile, TelegramLink, Feedback, MatchLog
    schemas.py         # Pydantic v2 схемы запросов/ответов, enum'ы
    matching.py        # алгоритм: нормализация, скоринг, объяснения, icebreaker, индекс
    security.py        # проверка Supabase JWT, проверка bot key, зависимости FastAPI
    errors.py          # AppError + коды + хендлеры (формат ошибок)
    services/
      __init__.py
      profiles.py      # CRUD профиля, преобразование Profile → Candidate
      telegram.py      # выдача и подтверждение кодов привязки
      candidates.py    # загрузка JSON + реальные профили из БД → список Candidate
    routes/
      __init__.py
      health.py
      match.py
      feedback.py
      profile.py
      telegram.py
  data/
    profiles.json      # 150+ синтетических анкет (генерируется скриптом, коммитится)
  scripts/
    generate_profiles.py
  tests/
    conftest.py
    test_health.py
    test_goal_compatibility.py
    test_match_top5.py
    test_match_errors.py
    test_explanations.py
    test_performance.py
    test_profile_security.py
    test_feedback.py
    test_telegram_link.py
    test_generator.py
  requirements.txt
  Dockerfile
  .dockerignore
  .env.example
  README.md
```

Допускается добавить `app/services/`, `app/errors.py` — это внутренняя структура, обязательные файлы из ТЗ присутствуют.

---

## 3. Модели данных

### 3.1 Enum'ы

```python
class Goal(str, Enum):
    find_job = "find_job"
    hire = "hire"
    find_mentor = "find_mentor"
    be_mentor = "be_mentor"
    find_cofounder = "find_cofounder"
    exchange_experience = "exchange_experience"

class Gender(str, Enum):
    male = "male"; female = "female"; other = "other"; undisclosed = "undisclosed"
```

### 3.2 Таблицы SQLite (SQLAlchemy 2.0, `Mapped[...]`)

**users**

| Поле | Тип | Примечание |
|---|---|---|
| id | str (PK) | `sub` из Supabase JWT (UUID) |
| email | str | из JWT, только для служебных целей |
| created_at | datetime | UTC |

**profiles** (1:1 с users)

| Поле | Тип | Ограничения |
|---|---|---|
| user_id | str, PK, FK users.id | |
| public_id | str, unique | вида `real_a1b2c3d4`; безопасный идентификатор в выдаче matching |
| full_name | str | 2–120 символов |
| age | int | 14–100 |
| gender | Gender | |
| city | str | ≤ 80 |
| email | str | контактный; **приватное поле** |
| phone | str \| null | E.164 `^\+[1-9]\d{7,14}$`; **приватное поле** |
| role | str | 2–80 |
| stack | JSON list[str] | ≤ 20 элементов, каждый ≤ 40 символов |
| experience_years | float | 0–60 |
| interests | JSON list[str] | ≤ 20 элементов |
| about | text | ≤ 1000 |
| goal | Goal | |
| is_public | bool | по умолчанию true; false — не попадает в чужие подборки |
| updated_at | datetime | UTC |

Профиль считается «профессионально заполненным», если заданы `role`, `stack`, `goal`. Только такие профили попадают в индекс кандидатов.

**telegram_links**

| Поле | Тип | Примечание |
|---|---|---|
| id | int PK | |
| user_id | str FK | владелец кода/привязки |
| code_hash | str, index | SHA-256 от кода; сам код не хранится |
| expires_at | datetime | now + 10 минут |
| used_at | datetime \| null | |
| telegram_user_id | int \| null, unique | заполняется при подтверждении |
| telegram_username | str \| null | |
| created_at | datetime | |

Один Telegram-аккаунт ↔ один пользователь; один пользователь ↔ один активный Telegram-аккаунт (новая привязка заменяет прежнюю).

**feedback**

| Поле | Тип | Примечание |
|---|---|---|
| id | int PK | |
| target_id | str | id рекомендованного человека (`user_042` / `real_…`) |
| rating | enum `like` \| `dislike` \| `contacted` | |
| comment | str \| null | ≤ 500 |
| score | int \| null | показанный score (0–100) |
| goal | Goal \| null | цель того, кто смотрел подборку |
| user_id | str \| null | если запрос авторизован |
| telegram_user_id | int \| null | если запрос от бота |
| created_at | datetime | |

**match_logs** (P2): `id, user_id|null, goal, processing_ms, top_ids JSON, created_at`.

### 3.3 Внутренняя структура `Candidate` (dataclass, в памяти)

```python
@dataclass(frozen=True)
class Candidate:
    id: str                    # "user_042" | "real_a1b2c3d4"
    name: str
    role: str
    role_category: str         # developer | designer | recruiter | entrepreneur | mentor | analyst | ai | marketing | product | other
    goal: Goal
    stack: frozenset[str]      # нормализованные навыки
    interests: frozenset[str]  # нормализованные интересы
    experience: float
    about: str
    city: str | None
    is_synthetic: bool
    tokens: tuple[str, ...]    # токены текста для TF-IDF
    vector: dict[str, float]   # L2-нормированный TF-IDF вектор
```

В `Candidate` **нет** email и телефона — утечка контактов невозможна на уровне типа.

---

## 4. Полный API-контракт

Базовый префикс: `/api`. Формат: JSON, UTF-8. Документация OpenAPI — `/docs`.

### 4.0 Общие правила

**Аутентификация**

| Режим | Заголовки | Где используется |
|---|---|---|
| Аноним | — | `/health`, `/match`, `/feedback` |
| Пользователь | `Authorization: Bearer <supabase_access_token>` | всё; обязателен для `/profile/me` и выдачи кода в `/telegram/link` |
| Telegram-бот | `X-Bot-Key: <BOT_API_KEY>` + `X-Telegram-User-Id: <int>` | `/match`, `/feedback`, `/profile/me`, подтверждение в `/telegram/link` |

**Формат ошибок** (все статусы ≥ 400):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Поле goal содержит недопустимое значение.",
    "details": [{"field": "goal", "issue": "Input should be 'find_job', 'hire', ..."}]
  }
}
```

| HTTP | code | Когда |
|---|---|---|
| 400 | `LINK_CODE_INVALID` | неверный/просроченный/использованный код привязки |
| 401 | `UNAUTHORIZED` | нет/невалидный/просроченный токен; неверный bot key |
| 403 | `FORBIDDEN` | попытка доступа к чужому ресурсу |
| 404 | `PROFILE_NOT_FOUND`, `MATCH_TARGET_NOT_FOUND` | |
| 409 | `TELEGRAM_ALREADY_LINKED` | этот Telegram уже привязан к другому пользователю |
| 422 | `VALIDATION_ERROR` | ошибка Pydantic (перехватывается и приводится к формату выше) |
| 429 | `RATE_LIMITED` | P2 |
| 500 | `INTERNAL_ERROR` | без стектрейса в теле ответа |

**CORS:** разрешённые origin'ы из `CORS_ORIGINS` (через запятую), по умолчанию `http://localhost:5173`.

### 4.1 `GET /api/health`

Auth: нет. Ответ `200`:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "candidates_loaded": 150,
  "database": "ok"
}
```

### 4.2 `POST /api/match`

Auth: опциональна (аноним / пользователь / бот).

Запрос:

```json
{
  "role": "Frontend Developer",
  "stack": ["React", "TypeScript"],
  "experience": 2,
  "interests": ["AI", "Startups"],
  "about": "Ищу работу в IT-команде",
  "goal": "find_job",
  "limit": 5
}
```

| Поле | Тип | Правила |
|---|---|---|
| role | str | 2–80 символов, после trim не пустая |
| stack | list[str] | 0–20 элементов, каждый 1–40 символов, дубликаты (без учёта регистра) схлопываются |
| experience | float | 0–60 |
| interests | list[str] | 0–20 элементов |
| about | str | 0–1000, по умолчанию `""` |
| goal | Goal | один из 6 |
| limit | int | 1–10, по умолчанию 5 |

Особый случай: если запрос авторизован (пользователь или бот) и тело пустое `{}` либо содержит только `limit`, используется сохранённая анкета пользователя (`use_profile`). Нет профиля → `404 PROFILE_NOT_FOUND`.

Если запрос авторизован, свой профиль исключается из кандидатов.

Ответ `200`:

```json
{
  "matches": [
    {
      "id": "user_042",
      "name": "Алия Садыкова",
      "role": "IT Recruiter",
      "score": 94,
      "goal": "hire",
      "reason": "Алия ищет React-разработчиков: у вас совпадают React и TypeScript, а опыт 2 года подходит под её вакансии.",
      "icebreaker": "Здравствуйте, Алия! Я Frontend-разработчик на React и TypeScript. Расскажете, какие проекты сейчас развивает ваша команда?"
    }
  ],
  "processing_ms": 24,
  "total_candidates": 149,
  "fallback_used": false
}
```

Гарантии:

- `matches` отсортирован по `score` (по убыванию), при равенстве — по `id` (детерминизм).
- Возвращается ровно `limit` рекомендаций, если в базе достаточно кандидатов (с учётом fallback-уровня, см. 5.5). Меньше — только если кандидатов физически меньше.
- `score` — целое 0–100. `reason` — 1–2 предложения. `icebreaker` — 1–3 предложения.
- В объекте match **никогда** нет `email`, `phone`, `age`, `city` конкретного человека (кроме указанных полей).
- `processing_ms` — измеренное время работы алгоритма (`time.perf_counter()`).

### 4.3 `POST /api/feedback`

Auth: опциональна (аноним / пользователь / бот).

Запрос:

```json
{
  "match_id": "user_042",
  "rating": "like",
  "comment": "Отличная рекомендация",
  "score": 94,
  "goal": "find_job"
}
```

| Поле | Правила |
|---|---|
| match_id | обязателен; должен существовать среди кандидатов, иначе `404 MATCH_TARGET_NOT_FOUND` |
| rating | `like` \| `dislike` \| `contacted` |
| comment | необязательно, ≤ 500 |
| score | необязательно, 0–100 |
| goal | необязательно, Goal |

Ответ `201`: `{"id": 17, "status": "saved"}`.

### 4.4 `GET /api/profile/me`

Auth: обязательна (пользователь или бот с привязанным Telegram). Ответ `200` — **собственный** полный профиль, включая email и phone:

```json
{
  "user_id": "8c1f…",
  "public_id": "real_a1b2c3d4",
  "personal": {
    "full_name": "Данияр Ермеков",
    "age": 27,
    "gender": "male",
    "city": "Алматы",
    "email": "daniyar@example.test",
    "phone": "+77001234567"
  },
  "professional": {
    "role": "Frontend Developer",
    "stack": ["React", "TypeScript"],
    "experience": 2,
    "interests": ["AI", "Startups"],
    "about": "Ищу работу в IT-команде",
    "goal": "find_job"
  },
  "is_public": true,
  "telegram_linked": false,
  "updated_at": "2026-11-20T09:41:00Z"
}
```

Нет профиля → `404 PROFILE_NOT_FOUND` (frontend показывает форму заполнения). Нет токена → `401`.

### 4.5 `PUT /api/profile/me`

Auth: обязательна. Создаёт профиль, если его ещё нет (upsert). Идентификатор пользователя берётся **только из токена**; параметра `user_id` в API нет — поэтому редактирование чужого профиля невозможно по построению.

Запрос (все секции необязательны, переданные поля обновляются; при первом создании обязательны `personal.full_name`, `personal.email`; профессиональная секция может быть заполнена позже отдельным PUT):

```json
{
  "personal": {"full_name": "Данияр Ермеков", "age": 27, "gender": "male", "city": "Алматы", "email": "daniyar@example.test", "phone": "+77001234567"},
  "professional": {"role": "Frontend Developer", "stack": ["React", "TypeScript"], "experience": 2, "interests": ["AI"], "about": "…", "goal": "find_job"},
  "is_public": true
}
```

Ответ `200` — тот же объект, что и в `GET /api/profile/me`. Неизвестные поля запрещены (`extra="forbid"`), чтобы нельзя было передать `user_id`, `public_id` и т.п. Бот обновляет профиль тем же способом через `X-Bot-Key` + `X-Telegram-User-Id`.

После успешного сохранения индекс кандидатов обновляется (добавляется/заменяется запись `real_…` без перезапуска сервера).

### 4.6 `POST /api/telegram/link`

Два режима на одном URL, определяются заголовками.

**Шаг A — выдача кода (пользователь, `Authorization: Bearer …`).** Тело пустое `{}`. Ответ `201`:

```json
{
  "code": "A7K9-2QXM",
  "expires_at": "2026-11-20T09:51:00Z",
  "deep_link": "https://t.me/<BOT_USERNAME>?start=link_A7K9-2QXM"
}
```

Код: 8 символов из алфавита без неоднозначных (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), генерируется через `secrets`, формат `XXXX-XXXX`, TTL 10 минут, одноразовый. В БД хранится только SHA-256. Предыдущие неиспользованные коды пользователя аннулируются.

**Шаг B — подтверждение (бот, `X-Bot-Key`).** Запрос:

```json
{"code": "A7K9-2QXM", "telegram_user_id": 123456789, "telegram_username": "daniyar"}
```

Ответ `200`: `{"linked": true, "user_id": "8c1f…"}`.
Ошибки: `400 LINK_CODE_INVALID` (неверный, просроченный или уже использованный — одинаковое сообщение, чтобы не раскрывать причину), `409 TELEGRAM_ALREADY_LINKED`, `401` при неверном bot key.
Защита от перебора: не более 5 неудачных попыток на `telegram_user_id` за 10 минут (in-memory счётчик), далее `429`.

Запрос без токена и без bot key → `401`.

### 4.7 Эндпоинты для бота (сводка)

| Нужно боту | Как |
|---|---|
| Рекомендации | `POST /api/match` с `X-Bot-Key` + `X-Telegram-User-Id` (пустое тело — по сохранённой анкете, либо полное тело) |
| Читать анкету | `GET /api/profile/me` с bot-заголовками |
| Менять анкету | `PUT /api/profile/me` с bot-заголовками |
| Обратная связь | `POST /api/feedback` с bot-заголовками |
| Привязка | `POST /api/telegram/link` (шаг B) |

Если `X-Telegram-User-Id` не привязан ни к одному пользователю: для `/match` с полным телом и `/feedback` — работает как аноним; для `/profile/me` и `/match` с пустым телом — `401 UNAUTHORIZED` с `message` «Telegram-аккаунт не привязан».

---

## 5. Алгоритм AI Matching

Алгоритм — **детерминированный гибридный скоринг** (rule-based + TF-IDF). Платные API не используются, случайность не используется: один и тот же запрос всегда даёт один и тот же результат.

### 5.1 Формула

```
base  = 0.40·S_skills + 0.25·S_interests + 0.20·S_experience + 0.15·S_semantic     (каждая компонента ∈ [0, 1])
score = round(100 · base · G)
```

`G` — множитель взаимности целей: `1.0` для строго взаимных целей, `0.75` для fallback-уровня (см. 5.5). Результат ограничивается диапазоном 0–100.

### 5.2 Взаимность целей (фильтр и множитель)

| Цель запрашивающего | Строго совместимые цели кандидата | Что рекомендуем |
|---|---|---|
| `find_job` | `hire` | работодателей и рекрутеров |
| `hire` | `find_job` | кандидатов |
| `find_mentor` | `be_mentor` | менторов |
| `be_mentor` | `find_mentor` | тех, кому нужен ментор |
| `find_cofounder` | `find_cofounder` | потенциальных кофаундеров (приоритет — `role_category = entrepreneur` или комплементарные роли) |
| `exchange_experience` | `exchange_experience` | коллег для обмена опытом |

Матрица `STRICT_PAIRS` лежит в `matching.py` как константа. Кандидаты вне `STRICT_PAIRS[goal]` на основном уровне **не участвуют**.

### 5.3 Нормализация текста

1. Приведение к нижнему регистру, `strip`, схлопывание пробелов, удаление знаков `.`, `#` внутри известных алиасов не требуется — используется словарь.
2. Словарь синонимов `SKILL_ALIASES` (минимум 60 записей), например: `react.js, reactjs → react`; `js → javascript`; `ts → typescript`; `node, nodejs → node.js`; `postgres → postgresql`; `k8s → kubernetes`; `ml → machine learning`; `ии, ai, artificial intelligence → ai`; `питон → python`; `фигма → figma`; `sql server → sql`; `ux/ui → ux`; `стартапы, startups → startup`.
3. Группы родственных навыков `SKILL_GROUPS` (для частичного совпадения 0.5):
   - frontend: react, vue, angular, svelte, next.js, javascript, typescript, html, css
   - backend: python, fastapi, django, flask, node.js, java, spring, go, php, c#, .net
   - data: sql, postgresql, pandas, tableau, power bi, excel, analytics, dbt
   - ml: machine learning, deep learning, pytorch, tensorflow, nlp, llm, computer vision, ai
   - design: figma, ux, ui, prototyping, design systems, illustration
   - devops: docker, kubernetes, aws, ci/cd, terraform, linux
   - product: product management, roadmap, jira, agile, scrum, user research
   - marketing: seo, smm, content, performance marketing, analytics, copywriting
   - hr: recruiting, sourcing, interviewing, employer branding
   - business: fundraising, sales, strategy, b2b, startup
4. Категория роли `role_category` определяется по ключевым словам в `role` (developer, designer, recruiter, entrepreneur, mentor, analyst, ai, marketing, product, other).

### 5.4 Компоненты

**S_skills (40%)** — направленное покрытие. Пусть `need` — множество навыков, которые нужны, `have` — множество навыков, которые предлагаются.

| Цель запрашивающего | need | have |
|---|---|---|
| `find_job` | stack кандидата (требования работодателя) | stack запрашивающего |
| `hire` | stack запрашивающего | stack кандидата |
| `find_mentor` | stack + interests запрашивающего | stack кандидата |
| `be_mentor` | stack кандидата | stack запрашивающего |
| `find_cofounder` | см. ниже | |
| `exchange_experience` | симметричный Жаккар | |

```
credit(n) = 1.0, если n ∈ have;  0.5, если в have есть навык из той же группы;  иначе 0
S_skills  = Σ credit(n) / |need|           (если need пуст → 0.3 как нейтральное значение)
```

Для `find_cofounder`: `S_skills = 0.5·overlap + 0.5·complement`, где `overlap` — взвешенный Жаккар по навыкам, `complement` = доля навыков кандидата, которых нет у запрашивающего (чем больше дополняющих навыков — тем выше), плюс бонус `+0.15` (с ограничением до 1.0), если `role_category` различается.
Для `exchange_experience`: `S_skills` = взвешенный Жаккар (точное совпадение 1, группа 0.5).

**S_interests (25%)** — косинусная мера для множеств: `|A ∩ B| / sqrt(|A|·|B|)`; интересы из одной тематической группы дают 0.5 за пару. Пустые интересы с любой стороны → 0.3.

**S_experience (20%)** — релевантность опыта по типу пары (`e_r` — опыт запрашивающего, `e_c` — кандидата):

| Пара | Формула |
|---|---|
| `find_job` ← `hire` | `e_c` — требуемый минимум. Если `e_r ≥ e_c` → 1.0; иначе `max(0, 1 − (e_c − e_r)/4)`. Перебор опыта не штрафуется, кроме `e_r > e_c + 8` → 0.8 |
| `hire` ← `find_job` | зеркально: `e_r` — минимум, `e_c` — опыт кандидата |
| `find_mentor` ← `be_mentor` | `gap = e_c − e_r`; `gap ≥ 3` → 1.0; `0 < gap < 3` → `gap/3`; `gap ≤ 0` → 0 |
| `be_mentor` ← `find_mentor` | `gap = e_r − e_c`; та же шкала |
| `find_cofounder` | `1 − min(|e_r − e_c|, 8)/8`, при `min(e_r, e_c) ≥ 2` бонус `+0.1` (до 1.0) |
| `exchange_experience` | `1 − min(|e_r − e_c|, 10)/10` |

**S_semantic (15%)** — смысловая близость описаний без внешних API:

- Текст запрашивающего = `role + about + interests`, текст кандидата — то же.
- Токенизация: слова `[a-zа-яё0-9+#.]{2,}`, стоп-слова RU/EN (список ~100), лёгкий стемминг — усечение до первых 6 символов для слов длиннее 6 (покрывает русскую морфологию: «разработчик/разработчики»).
- Добавляются биграммы соседних токенов.
- TF-IDF: IDF считается по корпусу кандидатов один раз при старте и пересчитывается при обновлении индекса; вектор запроса считается на лету с тем же IDF; косинусное сходство — по разреженным `dict`.
- Результат нормируется: `S_semantic = min(1, cos / 0.5)` (косинус 0.5 для коротких текстов уже считается очень высоким).
- Опционально (P2, флаг `USE_EMBEDDINGS=false` по умолчанию): `sentence-transformers` вместо TF-IDF. Не требуется для хакатона.

### 5.5 Отбор top-N и уровни кандидатов

1. **Уровень 1 (strict):** кандидаты с целями из `STRICT_PAIRS[goal]`, `G = 1.0`. Берём top `limit` по `score`.
2. **Уровень 2 (fallback):** если кандидатов уровня 1 меньше `limit`, добираем кандидатов с `exchange_experience` (для любой цели, кроме самой `exchange_experience`) и `find_cofounder` для `be_mentor`/`hire`/`find_job` не берём; `G = 0.75`. В ответе `fallback_used = true`.
3. Из выдачи исключаются: сам запрашивающий (по `user_id`), кандидаты с `score < 10` на уровне 2.
4. Сортировка: `score` ↓, затем `base` ↓, затем `id` ↑.
5. Синтетических кандидатов достаточно (≥ 15 на каждую цель), чтобы для любого запроса вернулось ровно 5.

### 5.6 Объяснение (`reason`, 1–2 предложения)

Генерируется шаблонами на русском из **фактов** конкретной пары (никаких «общих» фраз):

1. Берётся первая фраза по цели кандидата (шаблон на пару целей, 3 варианта на пару, выбор по `hash(requester_key + candidate.id) % 3` — детерминированно):
   - `find_job ← hire`: «{Имя} ищет {роль-слово} — у вас совпадают {навыки}.»
   - `hire ← find_job`: «{Имя} владеет {навыками} и имеет {N} лет опыта, что подходит под вашу вакансию.»
   - `find_mentor ← be_mentor`: «{Имя} ({роль}) готов(а) менторить по {навыкам}, опыт — {N} лет.»
   - `be_mentor ← find_mentor`: «{Имя} ищет наставника в {навыки/интересы}, где вы сильны.»
   - `find_cofounder`: «{Имя} ({роль}) дополняет вас навыками {complement}, и у вас общий интерес — {интерес}.»
   - `exchange_experience`: «У вас с {Имя} общие темы: {навыки/интересы}.»
2. Вторая фраза (если есть сильный сигнал): общие интересы («Вас объединяет интерес к {X}.») или опыт («Опыт {N} лет подходит под запрос.»).
3. Правила качества: упоминается минимум одно конкретное совпадение (навык, интерес или роль); не более 2 предложений; не более 240 символов; без пустых плейсхолдеров `{}`; если совпадений нет — используется честная формулировка «Совпадает цель знакомства; общие навыки пока не найдены.».
4. Согласование: списки навыков — максимум 3, через запятую и «и».

### 5.7 Icebreaker

Шаблоны по паре целей (по 3 варианта, детерминированный выбор), подставляются `{имя}`, `{мой_навык}`, `{их_тема}`:

- `find_job → hire`: «Здравствуйте, {имя}! Я {моя роль}, работаю с {мой_навык}. Расскажете, какие проекты сейчас развивает ваша команда?»
- `hire → find_job`: «Здравствуйте, {имя}! Мы ищем специалиста по {наш_навык}. Вам было бы интересно обсудить задачи?»
- `find_mentor → be_mentor`: «Здравствуйте, {имя}! Хочу развиваться в {тема}. Можно задать пару вопросов о вашем пути?»
- `be_mentor → find_mentor`: «Привет, {имя}! Я работаю с {мой_навык} и готов помочь с {их_тема}. С чего вам было бы удобнее начать?»
- `find_cofounder`: «Привет, {имя}! Мне близка тема {общий_интерес}. Какую проблему вы хотели бы решить командой?»
- `exchange_experience`: «Привет, {имя}! Вижу, что мы оба работаем с {общий_навык}. Каким подходом поделитесь за кофе?»

Имя берётся как первое слово из `name` (для формата «Фамилия Имя» — поле `first_name`, которое хранится в `profiles.json` как служебное). Если навыка/темы нет — шаблон без подстановки (никаких пустых мест).

### 5.8 Производительность

- Индекс (`Candidate` + TF-IDF векторы + индекс по целям `dict[Goal, list[Candidate]]`) строится при старте и после изменения реальных профилей.
- На запрос: нормализация запроса → один проход по кандидатам нужных целей → `heapq.nlargest`. Для 150–1000 кандидатов — десятки миллисекунд.
- Бюджет: p95 < 200 мс на локальной машине; жёсткое требование ТЗ — < 3000 мс (проверяется тестом).
- Запрещено: сетевые вызовы, чтение файлов, обращения к БД внутри цикла скоринга. Реальные профили подтягиваются в индекс заранее.

---

## 6. Генератор 150+ анкет

Файл: `backend/scripts/generate_profiles.py`. Запуск: `python scripts/generate_profiles.py [--count 180] [--seed 42] [--out data/profiles.json]`.

Требования:

1. **Детерминизм:** `random.Random(seed)`, по умолчанию seed = 42, count = 180 (минимум 150; скрипт отказывается генерировать меньше 150).
2. **Вымышленные данные:** имена собираются из списков имён и фамилий (рус./каз. звучание); перед записью проверяется уникальность пары. Email — `user_042@example.test` (домен `.test` зарезервирован и не существует), телефон — `+7000` + 7 цифр из диапазона явно тестовых номеров (`+70000000001`…). Совпадения с реальными людьми случайны; в файле поле `"is_synthetic": true` и пометка в README.
3. **ID:** `user_001 … user_180`.
4. **Профессии и распределение** (для 180 анкет; пропорции сохраняются при другом `--count`):

| Архетип | Кол-во | Примеры ролей | Типичные цели (вероятности) |
|---|---|---|---|
| Разработчики | 40 | Frontend/Backend/Fullstack/Mobile/DevOps Developer | find_job 45%, exchange_experience 25%, find_mentor 20%, find_cofounder 10% |
| Дизайнеры | 18 | UX/UI Designer, Product Designer | find_job 45%, find_mentor 25%, exchange_experience 20%, find_cofounder 10% |
| Рекрутеры | 18 | IT Recruiter, Tech Sourcer, HR Business Partner | hire 90%, exchange_experience 10% |
| Предприниматели | 22 | Founder, CEO, Startup Founder | hire 30%, find_cofounder 55%, exchange_experience 15% |
| Менторы | 20 | Senior Engineer Mentor, Tech Lead, Career Coach | be_mentor 90%, exchange_experience 10% |
| Аналитики | 16 | Data Analyst, BI Analyst, Business Analyst | find_job 40%, find_mentor 25%, exchange_experience 25%, hire 10% |
| AI-специалисты | 20 | ML Engineer, Data Scientist, NLP/LLM Engineer | find_job 30%, find_cofounder 20%, be_mentor 20%, exchange_experience 20%, hire 10% |
| Маркетологи | 14 | Performance Marketer, SMM Manager, Content Lead | find_job 35%, hire 20%, exchange_experience 30%, find_mentor 15% |
| Product Managers | 12 | Product Manager, Product Owner | find_cofounder 30%, find_job 25%, hire 20%, exchange_experience 25% |

5. **Гарантии покрытия** (проверяются тестом и самим скриптом, при нарушении — перегенерация с мутацией seed+1): каждая из 6 целей встречается у **не менее 15** анкет; для каждого архетипа есть не менее 5 анкет; `hire` и `find_job` присутствуют минимум по 30 анкет.
6. **Содержательность:** для каждого архетипа в скрипте есть пулы `stack` (8–15 навыков), `interests` (8–12), 6–10 шаблонов `about` на русском с подстановкой навыков/интересов, диапазон опыта (рекрутеры 2–10, менторы 7–20, джуны 0–2 при `find_job`/`find_mentor`). Для `hire` поле `stack` — **технологии, которые ищет** работодатель (шаблон `about`: «Ищу React-разработчиков в команду…»), `experience` — требуемый минимум лет.
7. **Формат записи `profiles.json`:**

```json
{
  "meta": {"count": 180, "seed": 42, "generated_at": "2026-11-20", "synthetic": true},
  "profiles": [
    {
      "id": "user_042",
      "name": "Садыкова Алия",
      "first_name": "Алия",
      "age": 29,
      "gender": "female",
      "city": "Алматы",
      "email": "user_042@example.test",
      "phone": "+70000000042",
      "role": "IT Recruiter",
      "role_category": "recruiter",
      "stack": ["React", "TypeScript", "Node.js"],
      "experience": 3,
      "interests": ["AI", "Startups", "HR Tech"],
      "about": "Ищу React-разработчиков в продуктовую команду. Люблю быстрые собеседования.",
      "goal": "hire",
      "is_synthetic": true
    }
  ]
}
```

8. Email и телефон хранятся в файле только как фиктивные данные и **никогда** не отдаются через API (в `Candidate` их нет).
9. Синтетические анкеты работают без регистрации: они загружаются из файла напрямую, в БД не копируются.

---

## 7. Авторизация и безопасность

### 7.1 Supabase Auth

Регистрация и вход выполняются frontend'ом через Supabase JS SDK (`signUp`, `signInWithPassword`). Подтверждение email включается в настройках проекта Supabase (*Authentication → Providers → Email → Confirm email*). До подтверждения Supabase не выдаёт сессию, поэтому backend получает только токены подтверждённых пользователей.

Backend проверяет `access_token`:

- Алгоритм по умолчанию: **HS256** с секретом `SUPABASE_JWT_SECRET` (Project Settings → API → JWT Secret). Если проект использует асимметричные ключи, включается `SUPABASE_JWKS_URL` (проверка по JWKS, `PyJWT[crypto]`).
- Проверки: подпись, `exp`, `aud == "authenticated"`, наличие `sub`. Опционально — `iss == SUPABASE_URL + "/auth/v1"`.
- При первом валидном токене запись `users` создаётся автоматически (`id = sub`, `email` из claim).
- Зависимости FastAPI в `security.py`:
  - `get_optional_user()` → `CurrentUser | None`
  - `require_user()` → `CurrentUser` или `401`
  - `resolve_actor()` → единая точка: Bearer-токен ИЛИ (`X-Bot-Key` + `X-Telegram-User-Id` → пользователь через `telegram_links`).
- `DEV_AUTH_BYPASS=false` по умолчанию. Для локальной разработки и тестов допускается заголовок `X-Dev-User: <uuid>` **только если** `ENV=dev` и `DEV_AUTH_BYPASS=true`; в production-режиме приложение при старте падает, если bypass включён.

### 7.2 Правила безопасности

| Требование | Реализация |
|---|---|
| Не хранить пароли | В схемах и моделях нет полей password; регистрация идёт мимо backend |
| Не показывать чужие email и телефоны | `Candidate` и `MatchItem` не содержат этих полей; тест проверяет, что в JSON ответа `/match` нет подстроки `@` ни у email, ни ключей `phone`/`email` |
| Секреты в `.env` | `SUPABASE_JWT_SECRET`, `BOT_API_KEY` читаются только из окружения; `.env` в `.gitignore`, в репозитории только `.env.example` |
| Нельзя редактировать чужие профили | Профиль адресуется только `/profile/me`, `user_id` берётся из токена; `extra="forbid"` в схеме |
| Синтетические анкеты без регистрации | `/match` доступен анониму |
| Защита bot key | `hmac.compare_digest`; ключ ≥ 32 символов, иначе предупреждение в логах |
| Телеграм-коды | `secrets`, хэш в БД, TTL 10 мин, одноразовые, лимит попыток |
| Валидация ввода | Pydantic v2: длины, диапазоны, enum; strip строк; ограничение размера тела (1 МБ) |
| SQL-инъекции | только ORM / параметризованные запросы |
| Логи | не пишем токены, bot key, email, телефоны |
| CORS | список origin'ов из env, не `*` вместе с credentials |

Переменные окружения (`.env.example`):

```
ENV=dev
APP_VERSION=1.0.0
DATABASE_URL=sqlite:///./data/meetmatch.db
CORS_ORIGINS=http://localhost:5173
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_JWT_SECRET=change-me
SUPABASE_JWKS_URL=
BOT_API_KEY=change-me-to-a-long-random-string-32chars
TELEGRAM_BOT_USERNAME=meetmatch_ai_bot
DEV_AUTH_BYPASS=false
PROFILES_PATH=data/profiles.json
```

---

## 8. Интеграция с Frontend и Telegram

### 8.1 Frontend (React + Vite + TypeScript)

Переменные frontend: `VITE_API_URL=http://localhost:8000`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key публичен; service role key во frontend **не** используется).

Сценарий:

1. `supabase.auth.signUp({email, password})` → пользователь подтверждает email по письму → `signInWithPassword`.
2. Токен: `const { data } = await supabase.auth.getSession(); data.session.access_token`.
3. `GET /api/profile/me`: `404 PROFILE_NOT_FOUND` → показать форму; затем `PUT /api/profile/me` (личные данные, затем профессиональная анкета).
4. `POST /api/match` (с токеном или без) → отрисовать `matches[]` (карточка: имя, роль, score, reason, icebreaker).
5. Кнопки 👍/👎 → `POST /api/feedback`.
6. «Подключить Telegram» → `POST /api/telegram/link` → показать `code` и `deep_link`.

Пример:

```ts
const res = await fetch(`${API}/api/match`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
  body: JSON.stringify({ role, stack, experience, interests, about, goal }),
});
if (!res.ok) throw (await res.json()).error;   // { code, message, details }
```

Контракт ответов — раздел 4; поля стабильны, добавление новых полей обратно совместимо. Типы TypeScript для frontend можно получить из `/openapi.json`.

### 8.2 Telegram-бот (aiogram, делает другой участник)

Бот хранит у себя только `BOT_API_KEY` и `BACKEND_URL`. Все запросы бота содержат заголовки `X-Bot-Key` и `X-Telegram-User-Id`.

Флоу привязки:

1. Пользователь на сайте нажимает «Подключить Telegram» → получает код и ссылку `https://t.me/<bot>?start=link_A7K9-2QXM`.
2. Бот получает `/start link_A7K9-2QXM`, вызывает `POST /api/telegram/link` с `{code, telegram_user_id, telegram_username}` и bot key.
3. Backend подтверждает привязку; бот отвечает «Аккаунт подключён».
4. Дальше бот вызывает `/api/match` (пустое тело → по сохранённой анкете), `/api/profile/me`, `/api/feedback`.

Backend ничего не отправляет в Telegram и не содержит кода бота. Ошибки бот разбирает по `error.code`.

---

## 9. Автоматические тесты

Pytest + `fastapi.testclient.TestClient`; БД — SQLite in-memory или временный файл (фикстура в `conftest.py`); `profiles.json` из репозитория (и мини-набор для юнит-тестов). Внешняя сеть в тестах не используется; JWT для тестов подписываются тестовым секретом через `PyJWT`.

| Файл | Проверки |
|---|---|
| `test_health.py` | `/api/health` → 200, `status=ok`, `candidates_loaded ≥ 150` |
| `test_goal_compatibility.py` | для каждой из 6 целей все кандидаты основного уровня имеют допустимую цель по `STRICT_PAIRS`; `find_job` → только `hire`; `hire` → только `find_job`; `find_mentor` → только `be_mentor`; `be_mentor` → только `find_mentor`; `find_cofounder` → `find_cofounder`; `exchange_experience` → `exchange_experience`; весовые коэффициенты в сумме = 1.0 |
| `test_match_top5.py` | ровно 5 результатов; сортировка по score ↓; score — int 0–100; нет дубликатов id; запрашивающий не в выдаче; детерминизм (два вызова → идентичный ответ без `processing_ms`); пример из ТЗ (Frontend, React/TypeScript, find_job) → в top-5 преобладают рекрутеры/работодатели и среди совпавших навыков есть React/TypeScript; запрос со стеком Python/ML и `hire` ранжирует кандидатов с ML выше, чем без; `limit=3` → 3 |
| `test_match_errors.py` | неверный `goal` → 422 `VALIDATION_ERROR`; пустая роль; `experience = -1` и `= 100`; `stack` из 50 элементов; `about` > 1000; пустое тело без авторизации → 422; неверный JSON → 422; единый формат `error`; нет стектрейса в 500 |
| `test_explanations.py` | `reason`: 1–2 предложения, ≤ 240 символов, нет `{`/`}`; содержит хотя бы один навык/интерес/роль, реально присутствующие у обеих сторон; `icebreaker` непустой, не содержит `{`/`}`, обращается по имени кандидата; все 6 целей |
| `test_performance.py` | 100 запросов подряд: максимум `processing_ms` < 3000, p95 по wall-clock < 500 мс; замер полного HTTP-запроса < 3 с |
| `test_profile_security.py` | `/profile/me` без токена → 401; с просроченным/поддельным токеном → 401; PUT создаёт профиль; GET возвращает свой email/phone; PUT с `user_id` в теле → 422 (`extra=forbid`); пользователь B не видит и не меняет профиль A; в `/match` нигде нет email/phone (в т.ч. реальных профилей, добавленных в тесте); `is_public=false` скрывает из чужих подборок |
| `test_feedback.py` | валидный feedback → 201; неизвестный `match_id` → 404; неверный `rating` → 422; работает без авторизации |
| `test_telegram_link.py` | выдача кода (только с токеном), формат кода; подтверждение ботом → 200; повторное использование → 400; просроченный код (подменой времени) → 400; неверный bot key → 401; чужой уже привязанный Telegram → 409; после привязки бот получает `/profile/me` и `/match` по `X-Telegram-User-Id`; код в БД хранится только хэшем |
| `test_generator.py` | ≥ 150 анкет; уникальные id; уникальные email с доменом `.test`; все цели представлены ≥ 15 раз; все архетипы присутствуют; повторный запуск с seed 42 даёт идентичный файл; валидация схемы записей |

Команда: `cd backend && pytest -q`. Тесты должны проходить за < 30 с.

---

## 10. Docker и инструкция запуска

### 10.1 `requirements.txt`

```
fastapi>=0.110
uvicorn[standard]>=0.29
sqlalchemy>=2.0
pydantic>=2.6
pydantic-settings>=2.2
pyjwt[crypto]>=2.8
email-validator>=2.1
httpx>=0.27
pytest>=8.0
```

Без `numpy`/`scikit-learn`/`torch` — matching написан на чистом Python.

### 10.2 `Dockerfile`

```dockerfile
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY data ./data
COPY scripts ./scripts
RUN mkdir -p /app/data && useradd -m appuser && chown -R appuser /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/api/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 10.3 Запуск

Локально:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # заполнить SUPABASE_JWT_SECRET и BOT_API_KEY
python scripts/generate_profiles.py                    # если data/profiles.json ещё нет
uvicorn app.main:app --reload --port 8000
# http://localhost:8000/docs
```

Docker:

```bash
cd backend
docker build -t meetmatch-backend .
docker run --rm -p 8000:8000 --env-file .env -v meetmatch-data:/app/data meetmatch-backend
```

Проверка:

```bash
curl http://localhost:8000/api/health
curl -X POST http://localhost:8000/api/match -H "Content-Type: application/json" \
  -d '{"role":"Frontend Developer","stack":["React","TypeScript"],"experience":2,"interests":["AI","Startups"],"about":"Ищу работу в IT-команде","goal":"find_job"}'
```

Тесты: `pytest -q`.

В `README.md` backend: назначение, быстрый старт, переменные окружения, таблица эндпоинтов, описание алгоритма (кратко), как перегенерировать анкеты, как запускать тесты, пометка, что все анкеты синтетические.

---

## 11. Definition of Done

- [ ] `data/profiles.json` содержит ≥ 150 анкет, генерируется скриптом
- [ ] `POST /api/match` возвращает 5 результатов для всех 6 целей, `processing_ms` < 3000
- [ ] Каждая рекомендация имеет score 0–100, reason (1–2 предложения), icebreaker
- [ ] Нет случайных оценок, нет заглушек вместо алгоритма, нет платных API
- [ ] `/profile/me` (GET/PUT), `/feedback`, `/telegram/link` работают по контракту
- [ ] Чужие email/телефоны не отдаются; чужой профиль изменить нельзя
- [ ] `pytest -q` зелёный; Docker-образ собирается и отвечает на `/api/health`
- [ ] `frontend/` и `telegram-bot/` не изменены (`git diff --stat` подтверждает)
