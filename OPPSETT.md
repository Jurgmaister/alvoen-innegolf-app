# Oppsett av Alvøen Innegolf-appen

Første utgave: forside med booking, meldinger med push-varsler, turneringsside med påmelding, infosider og en adminside for Jørgen og Erik. Kiosken har manuell varebeholdning; kobling til Vipps kommer senere.

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
4. Gå til `https://app.alvoeninnegolf.no/#/admin` (eller «Til admin-side» nederst på forsiden), logg inn og send en testmelding.
5. Under **Turnering** i admin fyller du inn neste runde. Under **Infosider** skriver du inn veiledning og regler.

---

## Kiosk (varebeholdning)

1. I Supabase: **SQL Editor → New query**, lim inn hele `supabase/kiosk.sql` og trykk **Run**.
2. På adminsiden: fanen **Kiosk** → **Legg til vare**. Fyll inn antall på lager, minimum og hvor mye dere fyller opp til.
3. Trykk **−** når noe er tatt ut, og **+** ved påfylling. Trykk på en vare for å endre den.
4. Varer under minimum havner på handlelisten, som kan deles med **Del handleliste**.

## Resultater (vinterserien)

1. I Supabase: **SQL Editor → New query**, lim inn hele `supabase/resultater.sql` og trykk **Run**.
2. Adminsiden → **Vinterserien → Spillere**: legg inn hver spiller med kjønn og Golfbox-indeks. HCP-indeksen (50 %) låses ved påmelding.
3. **Baneverdier**: kontroller par, CR og slope per runde. Runde 3, 5, 7 og 9 mangler og må fylles inn.
4. **Registrer score**: velg runde, skriv brutto slag og trykk Lagre. Plass, poeng og Order of Merit oppdateres i turneringsfanen med en gang.

5. **Tee-valg**: kjør `supabase/tee.sql` (etter `resultater.sql`). Da får hver runde fra runde 2 en liste med tee-er med par, CR og slope for herre og dame. Under **Registrer score** velger du tee per spiller; standard er rundens tee. Verdiene rettes under **Baneverdier**.

6. **Handicapkontroll**: kjør også `supabase/handicapkontroll.sql`. Under Vinterserien → Handicapkontroll velger du spiller og runde, skriver handicapet fra scorekortet i Trackman og logger kontrollen. Golfbox-sjekk registreres på spilleren.

8. **Hent scorer fra Trackman**: under **Registrer score** henter knappen brutto slag og tee for alle som har fullført runden i Trackman-turneringen. Spillere kobles på Trackman-navn (eller navn). Kontroller og trykk **Lagre**. Krever oppdatert push-funksjon. Ny sesong: legg inn ny turnerings-ID som secret `TRACKMAN_TOURNAMENT_ID`.

7. **Innmelding av Golfbox-HCP**: kjør `supabase/hcp_innmelding.sql`. Spillerne melder inn handicapet i turneringsfanen. Innmeldingene dukker opp øverst under **Vinterserien → Spillere**, der du legger dem til som ny spiller eller oppdaterer en eksisterende.

Beregningen følger regnearket «Vinterserie_2026-27_resultater_v4» (se `src/scoring.js`).

## Kontaktskjema og innboks

Kundene finner «Send oss en melding» på forsiden og på Meldinger-siden. Meldingene havner i fanen **Innboks** på adminsiden.

1. I Supabase: **SQL Editor → New query**, lim inn hele `supabase/kontakt.sql` og trykk **Run**.
2. **Edge Functions → push → Code**: erstatt koden med hele `supabase/functions/push/index.ts` og trykk **Deploy**. «Verify JWT» skal fortsatt være av.
3. Adminsiden → **Innboks** → **Varsle meg om nye meldinger → Slå på**. Gjør det på hver telefon som skal få varsel (på iPhone fra appen på hjemskjermen).

Svar kunden med knappene for e-post, SMS eller telefon, og trykk **Marker som behandlet**. Skjemaet har sperre mot spam: maks 5 meldinger per enhet i timen.

## E-post til spillerne (fra alvoeninnegolf@gmail.com)

Adminsiden → **Send melding** → «E-post til spillerne» sender til alle spillere med e-post i kontaktfeltet.

1. Logg inn på alvoeninnegolf@gmail.com → **Google-konto → Sikkerhet** → slå på **totrinnsbekreftelse**.
2. Gå til **myaccount.google.com/apppasswords**, lag et app-passord (navn: «Alvøen-appen») og kopier de 16 tegnene.
3. Supabase → **Edge Functions → Secrets**: legg til `GMAIL_USER` = `alvoeninnegolf@gmail.com` og `GMAIL_APP_PASSWORD` = app-passordet.
4. Oppdater push-funksjonen: **Edge Functions → push → Code**, lim inn hele `supabase/functions/push/index.ts`, **Deploy**.

Gmail tillater rundt 500 mottakere per døgn.

## Statistikk

1. I Supabase: **SQL Editor → New query**, lim inn hele `supabase/statistikk.sql` og trykk **Run**.
2. På adminsiden: fanen **Statistikk** viser antall enheter, hvor mange som har appen på hjemskjermen, push-varsler på og aktive brukere.

Tellingen er anonym (et tilfeldig nummer per enhet, ingen navn eller kontaktinfo) og starter når filen er kjørt.

## Daglig bruk (admin)

- **Send melding**: velg kategori (Turnering eller Drift), skriv tittel og tekst og send. Kundene som har valgt kategorien får push. Alle ser meldingen i appen.
- **Resultater**: registrer brutto slag etter hver runde; Order of Merit regnes ut automatisk.
- **Turnering**: turneringsinfo, regler og om påmeldingen er åpen.
- **Påmeldte**: se alle påmeldte med låst indeks, last ned til Excel.
- **Kiosk**: tell varer, se hva som er under minimum og del handlelisten.

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
