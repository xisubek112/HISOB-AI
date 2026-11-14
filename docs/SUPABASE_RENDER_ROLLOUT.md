# HISOBOT AI — Supabase PostgreSQL + Render Ishga Tushirish Qoʻllanmasi

Ushbu hujjat **HISOBOT AI** loyihasini JSON fayl bazasidan (`data/database.json`) **Supabase PostgreSQL** bazasiga xavfsiz oʻtkazish, Render serverini sozlash va favqulodda holatda darhol orqaga qaytarish (rollback) bosqichlarini oʻz ichiga oladi.

---

## 1. Supabase SQL Migratsiyalarini Ketma-Ket Ishga Tushirish

Supabase SQL Editor yoki `psql "$DATABASE_URL"` orqali migratsiyalarni **qatʼiy tartibda** bajaring:

1. `supabase/migrations/202611130001_initial_app_storage.sql` — `app_users`, `app_sessions`, `app_data` jadvallari va RLS/least-privilege ruxsatlar.
2. `supabase/migrations/202611130002_atomic_wallet_transfers.sql` — `app_idempotency_keys`, `app_audit_logs` va atomik `hisobot_transfer_between_wallets` RPC.
3. `supabase/migrations/202611130003_atomic_financial_operations.sql` — `hisobot_add_transaction`, `hisobot_update_transaction`, `hisobot_delete_transaction`, `hisobot_deposit_to_goal`, `hisobot_pay_debt`.
4. `supabase/migrations/202611130004_recurring_transactions.sql` — `hisobot_execute_recurring_schedule`.
5. `supabase/migrations/202611130005_atomic_user_registration.sql` — `hisobot_register_user_atomic` va oilaviy indeks/qidiruv indekslari.

Tekshirish:
```bash
TEST_DATABASE_URL="postgresql://..." npm run test:pg
```

---

## 2. Mavjud JSON Maʼlumotlarni Import Qilish (Xavfsiz Tartib)

### 2.1. Zaxira nusxa olish
```bash
cp data/database.json "data/database.backup.$(date +%Y%m%d_%H%M%S).json"
```

### 2.2. Dry-Run (bazaga yozmasdan tekshirish — sukut boʻyicha faol)
```bash
npm run import:supabase -- --file data/database.json --dry-run
```
* Eslatma: `usr_demo_hisobot_2026` (demo maʼlumotlar) sukut boʻyicha **oʻtkazib yuboriladi**. Faqat haqiqiy foydalanuvchilar import qilinadi.

### 2.3. Haqiqiy import (tasdiqlash kaliti bilan)
```bash
DATABASE_URL="postgresql://..." npm run import:supabase -- \
  --file data/database.json \
  --apply \
  --confirm=IMPORT_HISOBOT_DATA \
  --batch-size=100
```
* Skript idempotent (`ON CONFLICT DO NOTHING`): qayta ishga tushirilsa dublikat yaratmaydi.

---

## 3. Render Muhit Oʻzgaruvchilari (Environment Variables)

Render Dashboard → Service → **Environment** boʻlimida faqat server tomonda quyidagilarni kiriting (hech qachon `VITE_` prefiksi bilan bermang!):

| Kalit | Tavsiya etilgan qiymat | Izoh |
|---|---|---|
| `NODE_ENV` | `production` | Production rejimi |
| `DB_BACKEND` | `supabase` | PostgreSQL backendni yoqadi (`json` ga oʻzgartirib darhol rollback qilish mumkin) |
| `DATABASE_URL` | Supabase Pooler URL (`:6543` yoki `:5432`) | SSL bilan ulanish |
| `SUPABASE_URL` | `https://<project>.supabase.co` | Ixtiyoriy admin mijoz uchun |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Faqat backend! APK/frontendga kiritilmaydi |
| `PG_POOL_MAX` | `10` | Render va Supabase ulanish limiti uchun xavfsiz |
| `PG_SSL` | `true` | TLS majburiy |
| `SESSION_TTL_DAYS` | `30` | Sessiya amal qilish muddati |
| `ALLOWED_ORIGINS` | `https://<render-app>.onrender.com` | Capacitor (`capacitor://localhost`, `https://localhost`) avtomatik ruxsat etilgan |
| `GEMINI_API_KEY` | Gemini API kaliti | AI Yordamchi uchun |
| `ENABLE_DEMO_SEED` | `false` | Productionda qatʼiyan `false` |

---

## 4. Rollout Tekshiruvi va Tezkor Rollback

### Health Check
Deploydan soʻng tekshiring:
```bash
curl -s https://<render-app>.onrender.com/api/health
```
Kutiladigan javob (`200 OK`):
```json
{
  "status": "ok",
  "backend": "supabase",
  "latencyMs": 12
}
```

### Tezkor Rollback (10 soniya ichida)
Agar kutilmagan muammo yuzaga kelsa:
1. Render → Environment → `DB_BACKEND=json` qilib oʻzgartiring (yoki `DATABASE_URL` ni vaqtincha oʻchiring).
2. Render xizmatni avtomatik qayta ishga tushiradi va `/api/health` → `"backend": "json"` holatiga qaytadi.
3. PostgreSQL maʼlumotlari saqlanib qoladi va hech narsa oʻchirilmaydi.
