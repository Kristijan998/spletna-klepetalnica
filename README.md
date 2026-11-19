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
2. Za novo bazo v SQL editorju zaženi [supabase/schema.sql](supabase/schema.sql). Nato v novi ali obstoječi bazi uporabi [migracijo za zasebnost klepeta](supabase/migrations/202611180001_chat_privacy.sql).
3. V Storage ustvari bucket `uploads` in ga nastavi kot Public (da slike/priponke delujejo brez signed URL).
4. V `.env.local` (lokalno) ali na hostingu (produkcija) nastavi `VITE_SUPABASE_URL` in `VITE_SUPABASE_ANON_KEY`.
	- Če tvoj bucket ni `uploads`, nastavi še `VITE_SUPABASE_BUCKET`.

### Objava migracije za zasebnost

- V Supabase Auth omogoči **Anonymous Sign-Ins**. Gost na strani še vedno vpiše samo vzdevek. Supabase v ozadju izda sejo, ki jo aplikacija hrani v zavihku.
- Migracija zamenja pravila dostopa za profile, zasebne sobe, zasebna sporočila, podporo in dogodke prijav. Na obstoječi bazi uskladi izvedbo migracije z objavo nove različice. Stare različice uporabljajo ključ brez seje in po migraciji izgubijo dostop do teh tabel.
- Obstoječe vrstice brez potrjenega lastnika ostanejo v bazi. Gostje s starimi sejami se po objavi znova prijavijo z vzdevkom. Zasebne zgodovine brez potrjene povezave s Supabase računom se jim ne dodelijo.
- Skrbniške pravice do zaščitenih tabel zahteva Supabase seja s strežniško nastavljeno vrednostjo `app_metadata.chattko_admin = true`. Za obnovitev obstoječega skrbniškega profila mora biti `chat_profiles.owner_id` ID tega preverjenega računa.

### Skrbniški račun

1. V **Supabase Authentication → Users** ustvari potrjen račun z e-pošto in geslom.
2. V Supabase SQL editorju za ID tega uporabnika nastavi skrbniško pravico. Vrednost `UUID_UPORABNIKA` nadomesti z ID-jem računa iz Supabase.

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
     || '{"chattko_admin": true}'::jsonb
   where id = 'UUID_UPORABNIKA'::uuid;
   ```

3. Po uporabi migracije in objavi strani odpri vstopno stran z dodatkom `#skrbnik` na koncu naslova. Prva uspešna prijava ustvari profil **Admin**, nadaljnje prijave pa uporabijo isti profil.
