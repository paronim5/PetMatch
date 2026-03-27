# PetMatch – Dokumentace maturitního projektu

---

**Název práce:** PetMatch – webová aplikace pro párování majitelů domácích zvířat
**Autor:** *Pavlo Kosov*
**Studijní obor:** Informační technologie
**Škola:** Střední průmyslová škola elektrotechnická, Praha 2, Ječná 30
**Školní rok:** 2024/2025

---


## Poděkování

Děkuji vedoucímu práce za odborné vedení, cenné rady a trpělivost při konzultacích v průběhu celého projektu.

---

## Obsah

1. [Anotace](#1-anotace)
2. [Úvod](#2-úvod)
3. [Ekonomická rozvaha](#3-ekonomická-rozvaha)
4. [Vývoj](#4-vývoj)
   - 4.1 [Analýza a návrh](#41-analýza-a-návrh)
   - 4.2 [Použité technologie](#42-použité-technologie)
   - 4.3 [Architektura systému](#43-architektura-systému)
   - 4.4 [Struktura databáze](#44-struktura-databáze)
   - 4.5 [Backend – popis modulů](#45-backend--popis-modulů)
   - 4.6 [Frontend – popis stránek](#46-frontend--popis-stránek)
   - 4.7 [AI validace obrázků](#47-ai-validace-obrázků)
   - 4.8 [Platební systém](#48-platební-systém)
   - 4.9 [Real-time komunikace](#49-real-time-komunikace)
   - 4.10 [Průběh vývoje](#410-průběh-vývoje)
5. [Testování](#5-testování)
6. [Nasazení a spuštění](#6-nasazení-a-spuštění)
7. [Licence](#7-licence)
8. [Odkaz na repozitář](#8-odkaz-na-repozitář)
9. [Závěr](#9-závěr)
10. [Seznam použité literatury a zdrojů](#10-seznam-použité-literatury-a-zdrojů)
11. [Přílohy](#11-přílohy)

---

## 1. Anotace

Tato maturitní práce popisuje návrh, vývoj a nasazení webové aplikace **PetMatch** – platformy určené majitelům domácích zvířat, kteří hledají přátele pro svá zvířata nebo jiné majitele se stejnými zájmy. Aplikace využívá moderní webové technologie: backend je postaven na frameworku **FastAPI** (Python), frontend na **React**, data jsou uložena v **PostgreSQL** s rozšířením PostGIS pro geolokaci. Součástí systému je AI modul pro validaci nahrávaných fotografií (ONNX Runtime, MobileNetV2), real-time komunikace přes **WebSocket**, platební brána **Stripe** a autentizace přes **Google OAuth 2.0**. Aplikace je kontejnerizována pomocí **Docker Compose** a nasazena na cloudovém serveru **AWS EC2**.

**Klíčová slova:** webová aplikace, párování, FastAPI, React, PostgreSQL, Docker, AWS, WebSocket, Stripe, OAuth

---

## 2. Úvod

V současné době existuje celá řada aplikací zaměřených na setkávání lidí – ať už romantického nebo přátelského charakteru. Méně prostoru však dostávají majitelé domácích zvířat, kteří by rádi nalezli pro svého mazlíčka vhodného kamaráda na procházky, hry nebo dokonce chov. Právě tuto mezeru na trhu se snaží zaplnit projekt **PetMatch**.

PetMatch je plnohodnotná webová aplikace fungující na principu „swipování" – uživatel si vytvoří profil, nahraje fotografie svého mazlíčka a postupně prochází profily ostatních uživatelů. Pokud se dva uživatelé vzájemně „lajkují", vznikne mezi nimi shoda (match) a otevře se jim možnost chatovat v reálném čase.

Aplikace je navržena jako moderní single-page application (SPA) s odděleným frontendem a backendem komunikujícím přes REST API. Backend zajišťuje veškerou business logiku: správu uživatelů, algoritmus párování s ohledem na polohu a preference, zasílání notifikací, zpracování plateb a ochranu obsahu pomocí AI. Frontend poskytuje uživateli plynulé, vizuálně přitažlivé prostředí s animacemi, 3D prvky a responzivním designem.

Celý projekt byl vyvinut jako školní maturitní práce s cílem procvičit a demonstrovat znalosti moderních webových technologií, cloudového nasazení a integrace externích služeb (Google, Stripe, Firebase). Výsledkem je funkční, nasazená aplikace dostupná na adrese **https://paroniim.xyz**, která prošla řadou testovacích scénářů a je připravena k reálnému provozu.

---

## 3. Ekonomická rozvaha

### 3.1 Analýza konkurence

Na trhu existuje několik platforem s částečně podobným zaměřením:

| Aplikace | Zaměření | Nevýhody pro majitele zvířat |
|---|---|---|
| **Tindog** | Párování psů a jejich majitelů | Omezeno pouze na psy, chybí čeština |
| **MeetMyDog** | Procházky se psy | Minimální funkce, nemoderní UI |
| **Facebook skupiny** | Obecné komunity | Nepřehledné, bez algoritmu párování |
| **Instagram** | Sdílení fotek zvířat | Žádná párování ani chat funkcionalita |

**Výhody PetMatch oproti konkurenci:**
- Podporuje **všechna domácí zvířata** (psi, kočky, hlodavci, ptáci, ryby, plazi…)
- **Geolokační párování** – nalezne uživatele v okolí
- **Real-time chat** přímo v aplikaci
- **AI validace fotek** – zabraňuje nahrávání nevhodného obsahu
- **Moderní UX** s animacemi a 3D prvky
- **Předplatné systém** s bezplatnou základní verzí

### 3.2 Způsob propagace

- **Sociální sítě** (Instagram, TikTok, Facebook) – cílené reklamy na majitele domácích zvířat
- **SEO optimalizace** – klíčová slova spojená s mazlíčky a komunitami
- **Partnerství** s veterinárními klinikami, chovatelskými stanicemi a obchody s potřebami pro zvířata
- **Word-of-mouth** – sdílení shod a profilů zvířat na sociálních sítích
- **Freemium model** – bezplatná základní verze přiláká uživatele, prémiové funkce generují příjem

### 3.3 Náklady na provoz

| Položka | Měsíční náklad |
|---|---|
| AWS EC2 t3.micro | ~$9 |
| Doménové jméno (.xyz) | ~$1 |
| SSL certifikát (Let's Encrypt) | zdarma |
| Stripe (transakční poplatek) | 1,4 % + 0,25 € z každé platby |
| Firebase (push notifikace) | zdarma (Spark plán) |
| **Celkem základní provoz** | **~$10/měsíc** |

### 3.4 Návratnost investic

Při základní freemium modelu:
- **Bezplatný tier:** 50 swipů/den, 1 super like/den, zobrazování reklam
- **Premium:** 9,99 €/měsíc – neomezené swipy, 5 super liků/den, bez reklam
- **Premium Plus:** 19,99 €/měsíc – vše z Premium + zobrazení, kdo vás lajkoval

Již při **50 platících uživatelích** na úrovni Premium projekt pokryje náklady na provoz a začne generovat zisk. Cílem je do 6 měsíců od spuštění získat alespoň 500 aktivních uživatelů ve velkoměstech.

---

## 4. Vývoj

### 4.1 Analýza a návrh

Před samotným vývojem proběhla analýza požadavků, z níž vyplynuly následující funkční celky:

1. Registrace a autentizace uživatelů (e-mail + Google OAuth)
2. Správa profilu a nahrávání fotografií s AI kontrolou
3. Algoritmus párování s filtrováním podle vzdálenosti a preferencí
4. Real-time chat se čtenými potvrzeními a emoji reakcemi
5. Systém notifikací (in-app + push přes Firebase FCM)
6. Blokování a nahlašování uživatelů
7. Předplatné s platební bránou Stripe
8. Moderátorský panel pro správu nahlášení

### 4.2 Použité technologie

#### Backend
| Technologie | Verze | Účel |
|---|---|---|
| Python | 3.11 | Programovací jazyk |
| FastAPI | ≥ 0.109 | REST API framework |
| Gunicorn + Uvicorn | latest | ASGI server |
| SQLAlchemy | ≥ 2.0 | ORM (Object-Relational Mapping) |
| PostgreSQL | 15 | Relační databáze |
| GeoAlchemy2 | ≥ 0.14 | PostGIS – geolokační dotazy |
| Alembic | ≥ 1.13 | Databázové migrace |
| python-jose | ≥ 3.3 | JWT autentizace |
| passlib + bcrypt | latest | Hashování hesel |
| Stripe | ≥ 8.0 | Platební brána |
| ONNX Runtime | ≥ 1.17 | AI inference (klasifikace obrázků) |
| OpenCV (headless) | ≥ 4.9 | Detekce obličejů (Haar cascade) |
| Pillow | ≥ 12.0 | Zpracování obrázků |
| SlowAPI | ≥ 0.1.9 | Rate limiting |
| Prometheus instrumentator | ≥ 7.0 | Metriky a monitoring |
| Firebase Admin SDK | latest | Push notifikace (FCM) |

#### Frontend
| Technologie | Verze | Účel |
|---|---|---|
| React | 19 | UI framework |
| TypeScript / JSX | latest | Typová bezpečnost |
| Vite | 7 | Build nástroj |
| React Router | v7 | Klientské směrování (SPA) |
| Tailwind CSS | latest | Utility-first CSS framework |
| Three.js + R3F | latest | 3D grafika (úvodní scéna) |
| React Leaflet | latest | Mapy |
| @react-oauth/google | latest | Google Sign-In tlačítko |
| Firebase SDK | latest | Push notifikace na klientovi |

#### Infrastruktura
| Technologie | Účel |
|---|---|
| Docker + Docker Compose | Kontejnerizace všech služeb |
| Nginx (alpine) | Reverzní proxy, SSL terminace, gzip |
| Let's Encrypt + Certbot | Bezplatné SSL certifikáty |
| AWS EC2 t3.micro | Cloudový server (1 vCPU, 1 GB RAM) |

### 4.3 Architektura systému

Aplikace je rozdělena do šesti Docker kontejnerů, které spolu komunikují přes interní síť `petmatch-network`:

```
Internet
    │
    ▼
┌─────────┐   :80/:443
│  Nginx  │◄──────────────── Klient (prohlížeč)
│ (proxy) │
└────┬────┘
     │
     ├──► /           ──► frontend:80  (React SPA)
     ├──► /api/v1/    ──► backend:8000 (FastAPI)
     ├──► /api/v1/ws  ──► backend:8000 (WebSocket)
     └──► /static/    ──► backend:8000 (nahrané fotky)

┌──────────┐     ┌────────────┐     ┌────────────────┐
│ Backend  │────►│ PostgreSQL │     │ Stripe CLI     │
│ FastAPI  │     │ + PostGIS  │     │ (webhooks)     │
└──────────┘     └────────────┘     └────────────────┘
     │
     └──► Firebase FCM (push notifikace, externí)
     └──► Google OAuth (autentizace, externí)
     └──► Stripe API (platby, externí)
```

#### Diagram vrstev backendu

```
┌────────────────────────────────────────────────────┐
│                    API vrstva                       │
│  /auth  /users  /matching  /chat  /subscription    │
│  /notifications  /ws (WebSocket)                   │
├────────────────────────────────────────────────────┤
│                  Servisní vrstva                    │
│  AuthService  UserService  MatchingService          │
│  MessagingService  NotificationService              │
│  SubscriptionService  StripeService  AIService      │
├────────────────────────────────────────────────────┤
│               Infrastrukturní vrstva                │
│  Database (SQLAlchemy)  Repositories               │
│  EventBus  WebSocketManager                        │
├────────────────────────────────────────────────────┤
│                  Datová vrstva                      │
│  PostgreSQL + PostGIS  (Docker kontejner db)        │
└────────────────────────────────────────────────────┘
```

### 4.4 Struktura databáze

Databáze obsahuje tyto hlavní tabulky:

| Tabulka | Popis |
|---|---|
| `users` | Uživatelské účty (e-mail, hash hesla, tier, status) |
| `user_profiles` | Rozšířený profil (jméno, datum narození, poloha jako PostGIS POINT, bio) |
| `user_photos` | Fotografie uživatelů (URL, hash souboru, příznak primární fotky) |
| `user_preferences` | Preference párování (věkový rozsah, vzdálenost, pohlaví, deal-breakers) |
| `interests` | Katalog zájmů a koníčků |
| `user_interests` | Vazební tabulka uživatel ↔ zájem |
| `swipes` | Historie swipů (like, pass, super_like) |
| `matches` | Vzájemné shody mezi uživateli |
| `messages` | Zprávy chatu – **particionováno po měsících** |
| `message_reactions` | Emoji reakce na zprávy |
| `notifications` | Notifikace – **particionováno po měsících** |
| `blocks` | Blokování uživatelů |
| `reports` | Nahlášení s výsledkem moderace |
| `subscriptions` | Předplatné (tier, datum začátku/konce, Stripe ID) |
| `tier_limits` | Limity swipů/super liků podle tieru |
| `daily_swipe_limits` | Denní využití – automaticky resetováno |
| `push_tokens` | Zařízení pro FCM push notifikace |

**Klíčové optimalizace:**
- Tabulky `messages` a `notifications` jsou **range-partitionovány** podle měsíce pro efektivní archivaci a rychlejší dotazy
- PostGIS umožňuje výpočet vzdálenosti mezi uživateli přímo v SQL (`ST_Distance`)
- Unikátní omezení zabraňují duplikátním swipům, blokům a matchům
- Indexy na `user_id` a `created_at` pro rychlé stránkování

### 4.5 Backend – popis modulů

Zdrojový kód backendu je strukturován takto:

```
backend/
├── main.py                    # Vstupní bod aplikace, FastAPI instance
├── requirements.txt           # Závislosti
├── Dockerfile                 # Multi-stage build (builder + model-converter + runtime)
├── convert_model.py           # Build-time skript: konverze MobileNetV2 → ONNX
├── app/
│   ├── api/v1/
│   │   ├── api.py             # Registrace všech routerů
│   │   └── endpoints/
│   │       ├── auth.py        # Přihlášení, Google OAuth
│   │       ├── users.py       # Profil, fotky, blokování, nahlášení
│   │       ├── matching.py    # Kandidáti, swipy, shody
│   │       ├── chat.py        # Zprávy, reakce, čtení
│   │       ├── subscription.py # Stripe checkout, webhooky
│   │       ├── notifications.py# Notifikace
│   │       └── websocket.py   # WebSocket endpoint
│   ├── core/
│   │   ├── config.py          # Načítání .env (pydantic-settings)
│   │   ├── security.py        # JWT tvorba a ověřování
│   │   ├── logging.py         # Konfigurace logování
│   │   └── limiter.py         # SlowAPI rate limiter
│   ├── domain/
│   │   ├── models.py          # SQLAlchemy ORM modely
│   │   ├── schemas.py         # Pydantic schémata (request/response)
│   │   ├── enums.py           # Výčtové typy (SwipeType, SubscriptionTier…)
│   │   └── events.py          # EventBus – observer pattern
│   ├── infrastructure/
│   │   ├── database.py        # Singleton připojení k DB
│   │   └── repositories/      # Datové repozitáře (user, match, message…)
│   └── services/
│       ├── auth_service.py    # Logika přihlašování
│       ├── google_auth_service.py # Google OAuth2 flow
│       ├── user_service.py    # CRUD operace s uživateli
│       ├── matching_service.py # Algoritmus párování
│       ├── messaging_service.py# Chat logika
│       ├── notification_service.py # Notifikace + FCM
│       ├── subscription_service.py # Limity, tier správa
│       ├── stripe_service.py  # Stripe integrace
│       ├── ai_service.py      # ONNX inference – validace fotek
│       ├── websocket_manager.py # Správa WebSocket spojení
│       └── facade.py          # Vysokoúrovňová business logika
└── tests/                     # Pytest testovací sada
```

### 4.6 Frontend – popis stránek

```
frontendv2/src/
├── pages/
│   ├── LandingPage.jsx        # Veřejná úvodní stránka s animacemi
│   ├── LoginPage.jsx          # Přihlášení (e-mail + Google)
│   ├── SignUpPage.jsx         # Registrace
│   ├── CompleteProfilePage.jsx # Dokončení profilu po registraci
│   ├── ProfilePage.jsx        # Profil, správa předplatného
│   ├── MatchingPage.jsx       # Swipe karty (drag interakce)
│   ├── ChatPage.jsx           # Real-time chat s matches
│   ├── SwipeHistoryPage.jsx   # Historie swipů
│   ├── BlockHistoryPage.jsx   # Zablokovaní uživatelé
│   ├── ProjectGoal.jsx        # O projektu
│   ├── Features.jsx           # Funkce aplikace
│   ├── Technology.jsx         # Použité technologie
│   └── Contact.jsx            # Kontakt
├── components/
│   ├── NotificationBell.tsx   # Ikona notifikací s WebSocket
│   ├── BlockReportModals.jsx  # Modální okno blokování/nahlášení
│   ├── Toast.tsx              # Toast notifikace
│   ├── FloatingBoxes.jsx      # Animované plovoucí prvky
│   ├── CatScene.jsx           # 3D scéna (Three.js)
│   └── TypingText.jsx         # Animace psaní textu
├── services/
│   ├── api.ts                 # HTTP klient (Fetch API)
│   ├── auth.ts                # Autentizační volání
│   ├── matching.ts            # Swipe/match API
│   ├── subscription.ts        # Předplatné API
│   └── user.ts                # Profil API
├── context/
│   └── NotificationContext.tsx # Globální stav notifikací
└── utils/
    ├── firebase.ts            # Firebase inicializace
    └── imageValidation.ts     # Klientská validace obrázků
```

### 4.7 AI validace obrázků

Každá nahrávaná fotografie prochází validačním procesem na backendu:

1. **Bezpečnostní kontrola** – skenování raw bajtů na podezřelé vzory (`<script>`, `eval()`, `<?php`…)
2. **Klasifikace obsahu** – model MobileNetV2 (ImageNet) identifikuje top-5 tříd
3. **Detekce zvířete** – zkontroluje se, zda se v top-5 predikce nachází klíčové slovo zvířete
4. **Detekce obličeje** – OpenCV Haar cascade hlídá přítomnost lidského obličeje
5. **NSFW filtr** – klíčová slova jako `bikini`, `maillot` způsobí zamítnutí

**Architektura modelu:**
- Při sestavování Docker image se skript `convert_model.py` spustí ve stavebním kontejneru, kde pomocí `tf2onnx` převede Keras model `MobileNetV2` na formát `.onnx`
- Výsledný soubor `mobilenetv2.onnx` (~14 MB) se zkopíruje do finálního runtime image
- Za běhu se používá pouze `onnxruntime` (~50 MB RAM) bez celého TensorFlow (~600 MB)

### 4.8 Platební systém

Integrace se **Stripe** probíhá takto:

1. Uživatel klikne na „Upgradovat" v profilu
2. Backend vytvoří Stripe Checkout Session a vrátí URL
3. Uživatel je přesměrován na Stripe platební stránku
4. Po úspěšné platbě Stripe odešle webhook na `/api/v1/subscription/webhook`
5. Backend ověří podpis webhooku (`STRIPE_WEBHOOK_SECRET`) a aktualizuje tier uživatele v DB

Pro lokální vývoj běží `stripe` CLI kontejner, který přeposílá webhooky na `backend:8000`.

### 4.9 Real-time komunikace

WebSocket endpoint (`/api/v1/ws`) umožňuje:
- Okamžité zobrazení nových zpráv bez polling
- Notifikaci o novém matchi
- Zobrazení in-app notifikací v reálném čase

**Tok spojení:**
1. Frontend se připojí na `wss://paroniim.xyz/api/v1/ws?token=<JWT>`
2. Backend ověří JWT a zaregistruje spojení do `ConnectionManager`
3. Při nové události (zpráva, match, notifikace) servisní vrstva odešle event přes `EventBus`
4. `ConnectionManager` (jako Observer) doručí zprávu všem aktivním spojením daného uživatele

### 4.10 Průběh vývoje

Vývoj probíhal ve větěch systému **Git** (GitHub) a zahrnoval tyto fáze:

| Fáze | Obsah |
|---|---|
| 1. Návrh | Definice požadavků, výběr technologií, návrh DB schématu |
| 2. Backend základ | FastAPI setup, autentizace (JWT + Google OAuth), správa uživatelů |
| 3. Párování | Algoritmus geolokačního párování, swipe logika, match systém |
| 4. Chat | Real-time WebSocket, zprávy, reakce, čtená potvrzení |
| 5. Frontend | React SPA, stránky, routing, Tailwind UI, animace |
| 6. AI + bezpečnost | MobileNetV2 validace fotek, detekce obličeje, rate limiting |
| 7. Platby | Stripe integrace, subscription tiery, webhook handling |
| 8. Notifikace | Firebase FCM push notifikace, in-app notifikace |
| 9. Nasazení | Docker Compose, Nginx, Let's Encrypt SSL, AWS EC2 |
| 10. Optimalizace | Přechod TF → ONNX, PostgreSQL tuning, memory limity |

---

## 5. Testování

Projekt obsahuje automatizovanou testovací sadu v `backend/tests/` postavenou na frameworku **pytest**. Níže je popis pěti testovacích scénářů.

---

### Scénář 1 – Registrace uživatele a základní API

**Cíl:** Ověřit, že se uživatel může zaregistrovat, přihlásit a načíst svůj profil.

**Soubor:** `backend/tests/test_basic.py`

**Postup:**
1. Odeslat POST `/api/v1/users/` s platnými daty (e-mail, heslo, jméno)
2. Přihlásit se přes POST `/api/v1/auth/login` a získat JWT token
3. Načíst GET `/api/v1/users/me` s Bearer tokenem

**Očekávaný výsledek:** HTTP 200 s daty profilu, token je platný.

**Výsledek testu:** ✅ Passed – registrace proběhla správně, token ověřen, profil načten.

---

### Scénář 2 – Algoritmus párování a filtrace

**Cíl:** Ověřit, že algoritmus párování správně filtruje kandidáty podle věku a vzdálenosti a respektuje deal-breakers.

**Soubor:** `backend/tests/test_matching_service.py`

**Postup:**
1. Vytvořit dva uživatelské profily s rozdílnými preferencemi
2. Nastavit uživateli A deal-breaker „kouření"
3. Uživatel B má v profilu kouření označeno jako pravda
4. Zavolat matching algoritmus pro uživatele A

**Očekávaný výsledek:** Uživatel B se nesmí objevit mezi kandidáty.

**Výsledek testu:** ✅ Passed – deal-breaker správně vyfiltroval nekompatibilního kandidáta.

---

### Scénář 3 – Real-time chat a čtená potvrzení

**Cíl:** Ověřit odesílání zpráv, uložení do DB a správné nastavení příznaků přečtení.

**Soubor:** `backend/tests/test_chat_service.py`

**Postup:**
1. Vytvořit match mezi dvěma uživateli
2. Uživatel A odešle zprávu
3. Ověřit, že zpráva je uložena v DB s `is_read = False`
4. Uživatel B zavolá POST `/chat/matches/{id}/read`
5. Ověřit, že zpráva je označena jako přečtená

**Očekávaný výsledek:** Zpráva přechází ze stavu unread → read.

**Výsledek testu:** ✅ Passed – read receipts fungují správně pro obě strany.

---

### Scénář 4 – AI validace nahrávaných fotografií

**Cíl:** Ověřit, že AI modul správně rozlišuje fotky zvířat od fotek lidí nebo nevhodného obsahu.

**Soubor:** `backend/tests/test_ai_service.py`

**Postup:**
1. Nahrát obrázek psa (validní)
2. Nahrát obrázek lidského obličeje (měl by být zamítnut)
3. Nahrát obrázek bez zvířete (měl by být zamítnut)

**Očekávaný výsledek:**
- Pes: `is_animal=True`, `quarantine=False`
- Obličej: `has_human_face=True`, `quarantine=True`
- Nezvíře: `is_animal=False`, `quarantine=True`

**Výsledek testu:** ✅ Passed – ONNX model správně klasifikoval všechny testovací vstupy.

---

### Scénář 5 – Nasazení aplikace na AWS EC2

**Cíl:** Ověřit, že aplikace se správně sestaví a spustí v produkčním prostředí.

**Prostředí:** AWS EC2 t3.micro, Ubuntu 22.04, Docker Compose, doména paroniim.xyz

**Postup:**
1. Přihlásit se na server přes SSH
2. Přidat swap prostor (1 GB) pro t3.micro
3. Klonovat repozitář: `git clone https://github.com/paronim5/PetMatch.git`
4. Vyplnit `.env` soubor (viz sekce 6)
5. Spustit `./init-letsencrypt.sh` pro získání SSL certifikátu
6. Spustit `sudo docker compose up -d --build`
7. Ověřit dostupnost `https://paroniim.xyz`
8. Ověřit HTTPS přesměrování, API endpoint a WebSocket

**Očekávaný výsledek:** Všechny kontejnery běží (`docker compose ps`), web je dostupný přes HTTPS, API odpovídá na `/health`.

**Výsledek testu:** ✅ Passed – aplikace spuštěna, SSL certifikát platný, WebSocket funkční, platební brána v testovacím režimu ověřena.

---

## 6. Nasazení a spuštění

### Požadavky

- Server s Ubuntu 22.04 (doporučeno AWS EC2 t3.micro nebo lepší)
- Docker Engine ≥ 24.0 a Docker Compose plugin ≥ 2.20
- Doménové jméno s A záznamy směřujícími na IP serveru
- Účty: Google Cloud Console (OAuth), Stripe, Firebase (volitelné)

### Krok 1 – Přidat swap (nutné pro t3.micro)

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Krok 2 – Naklonovat projekt

```bash
git clone https://github.com/paronim5/PetMatch.git
cd PetMatch
```

### Krok 3 – Vytvořit .env soubor

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Vyplnit tyto hodnoty:

```env
SECRET_KEY=<náhodný-řetězec-min-32-znaků>
GOOGLE_CLIENT_ID=<z Google Cloud Console>
GOOGLE_CLIENT_SECRET=<z Google Cloud Console>
GOOGLE_REDIRECT_URI=postmessage
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://paroniim.xyz/profile?success=true
STRIPE_CANCEL_URL=https://paroniim.xyz/profile?canceled=true
BACKEND_CORS_ORIGINS=["https://paroniim.xyz","https://www.paroniim.xyz"]
```

### Krok 4 – SSL certifikát

```bash
chmod +x init-letsencrypt.sh
# Upravit e-mail v souboru init-letsencrypt.sh
./init-letsencrypt.sh
```

### Krok 5 – Spustit aplikaci

```bash
sudo docker compose up -d --build
```

Build trvá na t3.micro přibližně **20–40 minut** (stahování závislostí + konverze AI modelu).

### Krok 6 – Ověření

```bash
sudo docker compose ps          # všechny kontejnery Running
curl https://paroniim.xyz/health  # {"status": "healthy"}
sudo docker compose logs backend  # logy backendu
```

### DNS záznamy (Namecheap / Route 53)

| Typ | Host | Hodnota | TTL |
|---|---|---|---|
| A | @ | 23.21.34.9 | 30 min |
| A | www | 23.21.34.9 | 30 min |

### AWS Security Group

| Typ | Port | Zdroj |
|---|---|---|
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |
| SSH | 22 | Vaše IP |

---

## 7. Licence

Tento projekt je vydán pod licencí **MIT**.

```
MIT License

Copyright (c) 2025 [Jméno Příjmení]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 8. Odkaz na repozitář

- **GitHub:** https://github.com/paronim5/PetMatch
- **Živá aplikace:** https://paroniim.xyz

---

## 9. Závěr

Cílem maturitní práce bylo navrhnout a implementovat funkční webovou aplikaci pro majitele domácích zvířat, která by umožňovala párování uživatelů, real-time komunikaci a správu předplatného. Všechny tyto cíle byly splněny.

Projekt PetMatch je plnohodnotná full-stack aplikace zahrnující moderní backend (FastAPI, PostgreSQL, PostGIS), reaktivní frontend (React, TypeScript, Three.js), AI modul pro validaci obsahu (ONNX Runtime), platební systém (Stripe), push notifikace (Firebase FCM) a kontejnerizované nasazení na cloudu (AWS EC2, Docker, Nginx, Let's Encrypt).

Největší technickou výzvou byl **výkon na slabém cloudovém serveru**. Původní implementace využívala plný TensorFlow (~600 MB RAM při startu), který byl pro t3.micro s 1 GB RAM neprovozovatelný. Řešením byl přechod na ONNX Runtime s modelem konvertovaným při sestavování Docker image – RAM spotřeba AI modulu tak klesla z ~600 MB na ~50 MB.

Dalším cenným poznatkem byla **komplexnost integrace externích služeb** – každá integrace (Google OAuth, Stripe webhooky, Firebase FCM) s sebou přinesla specifické nároky na konfiguraci, bezpečnost a ladění.

Do budoucna by projekt bylo možné rozšířit o:
- Mobilní aplikaci (React Native)
- Pokročilejší AI doporučovací algoritmus (collaborative filtering)
- Video chat integraci
- Správu událostí (setkání majitelů zvířat)

Práce na projektu PetMatch mi umožnila procvičit a prohloubit znalosti v oblastech webového vývoje, databázových systémů, cloudové infrastruktury a integrace AI, které jsou relevantní pro reálnou praxi softwarového vývojáře.

---

## 10. Seznam použité literatury a zdrojů

1. FastAPI dokumentace – https://fastapi.tiangolo.com
2. React dokumentace – https://react.dev
3. SQLAlchemy dokumentace – https://docs.sqlalchemy.org
4. PostGIS dokumentace – https://postgis.net/docs/
5. Docker dokumentace – https://docs.docker.com
6. Nginx dokumentace – https://nginx.org/en/docs/
7. Stripe dokumentace – https://stripe.com/docs
8. Firebase Cloud Messaging – https://firebase.google.com/docs/cloud-messaging
9. ONNX Runtime dokumentace – https://onnxruntime.ai/docs/
10. tf2onnx – https://github.com/onnx/tensorflow-onnx
11. Let's Encrypt – https://letsencrypt.org/docs/
12. AWS EC2 dokumentace – https://docs.aws.amazon.com/ec2/
13. Tailwind CSS – https://tailwindcss.com/docs
14. Three.js – https://threejs.org/docs/
15. GeoAlchemy2 – https://geoalchemy-2.readthedocs.io

---

## 11. Přílohy

### Příloha A – Struktura projektu (zkrácená)

```
PetMatch/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # REST API endpointy
│   │   ├── core/               # Konfigurace, bezpečnost, logging
│   │   ├── domain/             # Modely, schémata, eventy
│   │   ├── infrastructure/     # DB připojení, repozitáře
│   │   └── services/           # Business logika
│   ├── tests/                  # Pytest testy
│   ├── main.py
│   ├── Dockerfile
│   ├── convert_model.py
│   └── requirements.txt
├── frontendv2/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   ├── context/
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
├── nginx/conf.d/               # Nginx konfigurace (SSL, proxy, gzip)
├── docker-compose.yml
├── DEPLOYMENT.md
└── init-letsencrypt.sh
```

### Příloha B – Přehled API endpointů

| Metoda | Endpoint | Popis |
|---|---|---|
| POST | `/api/v1/users/` | Registrace |
| POST | `/api/v1/auth/login` | Přihlášení, vrátí JWT |
| GET | `/api/v1/auth/google` | Google OAuth |
| GET | `/api/v1/users/me` | Vlastní profil |
| POST | `/api/v1/users/me/photos` | Nahrání fotky (s AI validací) |
| GET | `/api/v1/matching/candidates` | Kandidáti k swipování |
| POST | `/api/v1/matching/swipe` | Odeslat swipe |
| GET | `/api/v1/matching/matches` | Aktivní shody |
| GET | `/api/v1/chat/matches/{id}/messages` | Zprávy chatu |
| POST | `/api/v1/chat/matches/{id}/messages` | Odeslat zprávu |
| POST | `/api/v1/subscription/create-checkout-session` | Stripe checkout |
| WS | `/api/v1/ws` | WebSocket – real-time eventy |
| GET | `/health` | Health check |

### Příloha C – Proměnné prostředí (backend/.env)

```env
# Databáze
POSTGRES_SERVER=db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<heslo>
POSTGRES_DB=petmatch
POSTGRES_PORT=5432

# Bezpečnost
SECRET_KEY=<min. 32 náhodných znaků>

# Google OAuth
GOOGLE_CLIENT_ID=<z Google Cloud Console>
GOOGLE_CLIENT_SECRET=<z Google Cloud Console>
GOOGLE_REDIRECT_URI=postmessage

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://paroniim.xyz/profile?success=true
STRIPE_CANCEL_URL=https://paroniim.xyz/profile?canceled=true

# CORS
BACKEND_CORS_ORIGINS=["https://paroniim.xyz"]
```
