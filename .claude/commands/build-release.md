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
