# /build-release

Spusti release build CrowForge s branded splash installer.

## Postup

### Krok 1 — Zisti aktuálnu verziu
Prečítaj `package.json` a nájdi pole `"version"`. Toto je single source of truth.

### Krok 2 — Opýtaj sa na novú verziu
Použi `AskUserQuestion` s jednou otázkou:
- Otázka: "Aktuálna verzia je X.Y.Z. Akú verziu chceš použiť pre tento build?"
- Header: "Verzia"
- Možnosti: patch (napr. X.Y.Z+1), minor (napr. X.Y+1.0), zachovaj súčasnú, vlastná

Ak user vyberie "zachovaj súčasnú", pokračuj s existujúcou verziou bez zmeny súborov.
Ak user vyberie vlastnú, použi ním zadanú hodnotu.
Ak user vyberie patch alebo minor, vypočítaj správne číslo.

Vždy validuj semver formát (musí byť `X.Y.Z` — tri čísla oddelené bodkami, napr. `0.4.2`).

### Krok 3 — Nastav verziu vo všetkých súboroch
Ak sa verzia mení, aktualizuj ju pomocou Edit tool v týchto súboroch (všetky naraz):

1. **`package.json`** — pole `"version": "X.Y.Z"`
2. **`src-tauri/Cargo.toml`** — riadok `version = "X.Y.Z"` (iba prvý výskyt, v sekcii `[package]`)
3. **`src-tauri/tauri.conf.json`** — pole `"version": "X.Y.Z"`
4. **`src/lib/constants.ts`** — `export const APP_VERSION = "X.Y.Z";`
5. **`build.ps1`** — všetky výskyty starej verzie v komentároch/Write-Host riadkoch
6. **`installer/package.json`** — pole `"version": "X.Y.Z"`
7. **`installer/src-tauri/Cargo.toml`** — riadok `version = "X.Y.Z"` (v sekcii `[package]`)
8. **`installer/src-tauri/tauri.conf.json`** — pole `"version": "X.Y.Z"`
9. **`installer/src/index.html`** — text `vX.Y.Z · Local AI Workspace`
10. **`installer/build.ps1`** — default parameter `$Version = "X.Y.Z"`
11. **`backend/app.py`** — riadok `"version": "X.Y.Z"` v `/health` endpointe
12. **`CLAUDE.md`** — text `Current version: **X.Y.Z**` v Build & Release sekcii

### Krok 3.5 — Verifikácia verzií (pre-build check)
Po nastavení verzií spusti grep cez Bash aby si overil že stará verzia sa nikde nenachádza:
```
grep -rn "STARA_VERZIA" package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src/lib/constants.ts backend/app.py CLAUDE.md build.ps1 installer/package.json installer/src-tauri/Cargo.toml installer/src-tauri/tauri.conf.json installer/src/index.html installer/build.ps1
```
Ak sa nájdu výskyty starej verzie, oprav ich pred buildom.

### Krok 4 — Spusti build
Spusti pomocou Bash tool:
```
powershell -ExecutionPolicy Bypass -File ./build.ps1
```

Toto automaticky:
1. Zabalí Python backend cez PyInstaller
2. Skopíruje sidecar binary
3. Buildne hlavnú CrowForge app (NSIS silent installer)
4. Skopíruje NSIS setup do `installer/` pre embedding
5. Buildne branded splash installer wrapper (`CrowForge-Install.exe`)

Počas behu informuj používateľa o progrese (build môže trvať niekoľko minút).

### Krok 5 — Reportuj výsledok
Po úspešnom builde vypiš:
- Verzia: X.Y.Z
- Hlavný installer: `src-tauri/target/release/bundle/nsis/` (silent, len pre interné použitie)
- **Branded installer**: `installer/src-tauri/target/release/bundle/nsis/` — toto je finálny `CrowForge-Install.exe` na distribúciu
- Zoznam `.exe` súborov z oboch priečinkov (použiť Glob alebo Bash `ls`)

Ak build zlyhá, zobraz posledných 50 riadkov chybového výstupu a navrhni riešenie.

### Krok 6 — Post-build verifikácia
Po úspešnom builde spusti:
1. `npx tsc --noEmit` — TypeScript check (0 chýb = OK)
2. `grep '"version"' backend/app.py` — over že backend health endpoint má správnu verziu
3. Over že `dist/CrowForge-Install.exe` existuje a má rozumnú veľkosť (>50 MB)
