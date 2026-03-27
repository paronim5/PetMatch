# PetMatch

Webová aplikace pro párování majitelů domácích zvířat.

**Živá aplikace:** https://paroniim.xyz
**Dokumentace:** [DOKUMENTACE.md](./DOKUMENTACE.md)

---

## O projektu

PetMatch umožňuje majitelům domácích zvířat nacházet uživatele se stejnými zájmy ve svém okolí. Funguje na principu swipování – vzájemný like otevře real-time chat.

**Hlavní funkce:**
- Registrace přes e-mail nebo Google účet
- Swipe-based párování s filtrací podle vzdálenosti a preferencí
- Real-time chat (WebSocket) s emoji reakcemi a čtenými potvrzeními
- AI validace nahrávaných fotek (MobileNetV2 + detekce obličeje)
- Systém předplatného (Free / Premium / Premium Plus) přes Stripe
- Push notifikace přes Firebase FCM
- Blokování a nahlašování uživatelů

---

## Technologie

| Vrstva | Stack |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy, PostgreSQL + PostGIS |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Three.js |
| AI | ONNX Runtime (MobileNetV2), OpenCV |
| Infrastruktura | Docker Compose, Nginx, Let's Encrypt, AWS EC2 |
| Externí služby | Stripe, Google OAuth 2.0, Firebase FCM |

---

## Rychlý start (lokální vývoj)

```bash
git clone https://github.com/paronim5/PetMatch.git
cd PetMatch
cp backend/.env.example backend/.env
# Vyplňte .env soubor
docker compose up --build
```

Aplikace poté běží na `http://localhost`.

---

## Nasazení na produkci

Viz [DOKUMENTACE.md – sekce 6](./DOKUMENTACE.md#6-nasazení-a-spuštění) nebo [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Struktura projektu

```
PetMatch/
├── backend/          # FastAPI backend
├── frontendv2/       # React frontend
├── nginx/            # Nginx konfigurace
├── docker-compose.yml
├── DOKUMENTACE.md    # Kompletní dokumentace (česky)
└── DEPLOYMENT.md     # Průvodce nasazením
```

---

## Licence

MIT – viz [DOKUMENTACE.md – sekce 7](./DOKUMENTACE.md#7-licence)
