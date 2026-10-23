# Oppsett av Alvøen Innegolf-appen

Første utgave: forside med booking, meldinger med push-varsler, turneringsside med påmelding, infosider og en adminside for Jørgen og Erik. Kiosk/varelager kommer i neste versjon.

Du gjør steg 1–4 én gang. Regn med ca. 45 minutter. Ingen programmering trengs.

---

## 1. Opprett databasen (Supabase)

1. Gå til **supabase.com**, lag en gratis konto og trykk **New project**.
   - Navn: `alvoen-innegolf`
   - Region: **Stockholm (eu-north-1)** eller Frankfurt
   - Lagre databasepassordet et trygt sted (du trenger det sjelden).
2. Når prosjektet er klart: **SQL Editor → New query**.
3. Åpne filen `supabase/schema.sql`, kopier alt, lim inn og trykk **Run**. Du skal få «Success».
4. Lag en ny spørring (**New query**) med e-postadressene dere logger inn med, og trykk **Run**:

   ```sql
   insert into public.admins (email) values
     ('din@epost.no'),
     ('erik@epost.no')
   on conflict do nothing;
   ```

## 2. Innlogging for dere to

Adminsiden bruker e-post og passord.

1. **Authentication → Users → Add user → Create new user**
   - E-post og et passord du velger
   - Huk av **Auto Confirm User**
   - Gjør det samme for Erik (med hans e-post), og gi ham passordet.
2. E-postene må også stå i `admins`-tabellen (steg 1, punkt 4).
3. Anbefalt: **Authentication → Sign In / Providers** → slå av **Allow new users to sign up**.
   Da kan ingen andre lage brukere. Brukere du lager selv i steg 1 virker fortsatt.

Glemt passord: **Authentication → Users** → trykk på brukeren → sett nytt passord.

## 3. Push-funksjonen

1. **Edge Functions → Secrets**. Legg inn de tre verdiene fra filen `Push-nokler-HEMMELIG.txt`:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` og `VAPID_SUBJECT`.
2. **Edge Functions → Deploy a new function → Via Editor**.
   - Navn: `push` (nøyaktig dette)
   - Slett eksempelkoden, lim inn hele `supabase/functions/push/index.ts` og trykk **Deploy**.
3. Åpne funksjonen → **Details/Settings** og slå **av** «Enforce JWT verification» (eller «Verify JWT»). Lagre.
   - Funksjonen sjekker selv at bare dere to kan sende meldinger.

## 4. Send meg to verdier

**Project Settings → API Keys** (eller **API**). Send meg:
- **Project URL** (ser ut som `https://abcdefgh.supabase.co`)
- **Publishable key** (eller **anon public key**)

Begge er offentlige og trygge å dele. **Ikke** send `service_role`/secret key.

Da legger jeg dem inn i appen og publiserer den.

## 5. Legg appen ut på nett (GitHub Pages)

Koden ligger i GitHub-prosjektet `Jurgmaister/alvoen-innegolf-app`. Hver gang koden endres, bygges og publiseres appen automatisk.

1. På GitHub: åpne prosjektet → **Settings → Pages**.
2. Under **Build and deployment → Source** velger du **GitHub Actions**.
3. Under **Custom domain** skriver du `app.alvoeninnegolf.no` og trykker **Save**.
4. Når domenet er klart (steg 6), huker du av **Enforce HTTPS**.

## 6. Domenet (Domeneshop)

1. Logg inn på **domeneshop.no → Mine domener → alvoeninnegolf.no → DNS-pekere**.
2. Legg til en ny peker:
   - Type: **CNAME**
   - Vert: `app`
   - Data: `jurgmaister.github.io`
3. Vent 5–60 minutter. GitHub lager HTTPS-sertifikatet automatisk.

## 7. Test

1. Åpne `https://app.alvoeninnegolf.no` på mobilen.
2. iPhone: **Del → Legg til på Hjem-skjerm**, åpne appen derfra. Android: trykk **Installer**.
3. Gå til **Meldinger** og slå på push-varsler.
4. Gå til `https://app.alvoeninnegolf.no/#/admin` (eller «For ansatte» nederst på forsiden), logg inn og send en testmelding.
5. Under **Turnering** i admin fyller du inn neste runde. Under **Infosider** skriver du inn veiledning og regler.

---

## Daglig bruk (admin)

- **Send melding**: velg kategori (Turnering, Drift, Tilbud), skriv tittel og tekst og send. Kundene som har valgt kategorien får push. Alle ser meldingen i appen.
- **Turnering**: oppdater neste runde og Order of Merit etter hver runde (fra regnearket deres).
- **Påmeldte**: se alle påmeldte med låst indeks, last ned til Excel.
- **Infosider**: endre «Slik bruker du simulatoren» og «Adgang, kiosk og regler».

Ny administrator: legg e-posten inn i tabellen `admins` i Supabase (**Table Editor → admins → Insert row**).

## Godt å vite

- **Push på iPhone** krever iOS 16.4 eller nyere og at appen er lagt på hjemskjermen. Appen viser kundene hvordan.
- **Booking** åpner Albaplay i nettleseren. Kan byttes til visning i appen senere hvis Albaplay åpner for det.
- **Kostnad**: Supabase og GitHub Pages er gratis på dette nivået. Supabase setter gratisprosjekter på pause etter en uke uten aktivitet; med jevnlig bruk av appen skjer ikke det.
- **Personvern**: påmeldingen lagrer navn, e-post, mobil og handicap. Bare innloggede administratorer kan lese dem.

## For utviklere

```
npm install
cp .env.example .env   # fyll inn verdiene
npm run dev            # lokal utvikling
npm run build          # ferdig app i dist/
```

Struktur: `src/pages` (sider), `src/push.js` (push i nettleseren), `public/sw.js` (service worker), `supabase/schema.sql` (database og tilgangsregler), `supabase/functions/push` (sending av push).
