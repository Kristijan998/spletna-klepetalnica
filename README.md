# Spletna klepetalnica

React + Vite klepetalnica.

- Brez dodatne nastavitve deluje lokalno (localStorage) – primerno za demo.
- Če nastaviš Supabase, deluje kot pravi multi-user chat (podatki so na spletu in delijo se med napravami).

## Zagon

1. Namesti odvisnosti: `npm install`
2. Zaženi razvojni strežnik: `npm run dev`

## Build za objavo

- Produkcijski build: `npm run build`
- Lokalni preview build-a: `npm run preview`

## Nastavitve (.env.local)

Neobvezno:

```bash
# Supabase (za pravi multi-user način)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SUPABASE_BUCKET=uploads

# Google prijava (OAuth Client ID)
VITE_GOOGLE_CLIENT_ID=...

# Admin koda za prijavo (vpiše se kot ime)
VITE_ADMIN_LOGIN_CODE=  # (vpiši samo lokalno v .env.local, NE objavljaj v repozitorij)
```

Opomba (Windows): preveri, da se datoteka imenuje točno `.env.local` (ne `.env.local.txt`). Po spremembi `.env.local` je treba razvojni strežnik ponovno zagnati.

Namig: uporabi predlogo `.env.example` in jo kopiraj v `.env.local`.

## Podatki

Če Supabase ni nastavljen:
- Vsi profili, sobe in sporočila se shranjujejo v localStorage v brskalniku.

Če je Supabase nastavljen:
- Podatki so v Supabase Postgres in jih vidijo vsi uporabniki na spletu.

## Supabase setup (kratko)

1. Ustvari Supabase projekt.
2. V Supabase SQL editorju zaženi skripto: [supabase/schema.sql](supabase/schema.sql)
3. V Storage ustvari bucket `uploads` in ga nastavi kot Public (da slike/priponke delujejo brez signed URL).
4. V `.env.local` (lokalno) ali na hostingu (produkcija) nastavi `VITE_SUPABASE_URL` in `VITE_SUPABASE_ANON_KEY`.
	- Če tvoj bucket ni `uploads`, nastavi še `VITE_SUPABASE_BUCKET`.
