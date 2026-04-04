# Simple Flying

Simple Flying er en Owlbear Rodeo extension til hurtig og enkel visualisering af flyvende tokens i et top-down map.

## Hurtig lokal test

### Start

1. Kør `npm run dev`.
2. Åbn Owlbear Rodeo.
3. Installer eller reload extensionen fra din lokale Vite URL.
4. Åbn extensionens popover.
5. Lav én lille kodeændring ad gangen.
6. Reload popoveren eller extensionen med det samme efter hver ændring.

## Faste testscener i Owlbear

Behold disse tre scener klar, så du hurtigt kan hoppe mellem dem:

- `Single token`: Ét normalt token til hurtig toggle-test.
- `Multi token`: Flere tokens valgt samtidig til batch-adfærd.
- `Edge cases`: Mindst ét token med usædvanlig størrelse eller rotation.

## Vælg test efter ændringstype

Kør kun de checks, der matcher den idé du arbejder på:

- `UI-ændring`: Bekræft at popover åbner, knappen kan klikkes, og selection-state stadig giver mening.
- `Metadata/logik`: Bekræft toggle on/off, at flying-data bliver sat korrekt, og at metadata bliver ryddet ved disable.
- `Shadow/visual`: Bekræft at shadow bliver oprettet, placeret fornuftigt, følger størrelse/rotation og bliver slettet igen.

## Fast smoke test

Kør denne hver gang du har lavet en ændring og vil sanity-checke den hurtigt:

1. Vælg ét token.
2. Klik `Toggle Flying`.
3. Bekræft at en shadow bliver oprettet.
4. Klik `Toggle Flying` igen.
5. Bekræft at shadow fjernes.
6. Bekræft at tokenet ikke længere opfører sig som flying.

## Fast regression-checkliste

Kør denne, når en idé ser lovende ud, før du går videre:

- Ingen selection må ikke crashe eller gøre noget synligt forkert.
- Ét token skal kunne toggles on/off flere gange i træk.
- Flere valgte tokens skal toggles samlet.
- Shadows må ikke blive efterladt efter disable.
- Ikke-flying tokens må ikke blive påvirket.

## Manuel testplan

### Baseline

- Extensionen loader korrekt fra localhost.
- Popoveren åbner.
- `Toggle Flying`-knappen er klikbar.

### Flying toggle

- Toggle på ét valgt token opretter flying-state.
- Toggle igen fjerner flying-state.
- Ingen selection giver ingen fejl.

### Shadow behavior

- Shadow oprettes én gang pr. token.
- Shadow slettes ved disable.
- Shadow følger forventet størrelse og rotation.

### Multi-selection

- Flere tokens kan toggles i samme handling.
- Blandet state må ikke give inkonsistent resultat.

### Repeatability

- Samme test kan køres hurtigt flere gange i træk.
- Reload af popover eller extension må ikke efterlade ghost shadows.

## Arbejdsrytme

Brug denne faste rytme, når du tester nye idéer:

1. Vælg den relevante testscene.
2. Lav én lille ændring.
3. Reload med det samme.
4. Kør kun relevante checks.
5. Afslut med smoke test.
6. Kør regression-checklisten, hvis ændringen skal beholdes.
