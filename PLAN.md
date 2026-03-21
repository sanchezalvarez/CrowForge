# CrowForge — Sheets Feature Plan

> Posledný update: 2026-03-21

## ✅ Hotovo

### Sprint 3 — Základné spreadsheet UX
| Funkcia | Detail |
|---------|--------|
| **Find & Replace** | FindBar rozšírený o replace mód (toggle); Replace current + Replace All; počítadlo nahradení |
| **Status bar agregáty** | SUM / AVG / COUNT zo selected buniek (≥2 numerické); zobrazené v status bare |
| **Formátovanie čísel** | Tlačidlá `%`, `$`, `.0` (−decimal), `.00` (+decimal) v toolbare; `numFmt`/`numDecimals` uložené v `CellFormat`; renderovanie v bunkách |
| **Paste Special** `Ctrl+Shift+V` | Prilepí iba display hodnoty bez formuliek; `copyValues` ref ukladaný súbežne s `copySelection` |
| **Auto-fit všetkých stĺpcov** | Tlačidlo `↔` v toolbare + link v status bare; canvas text measurement; PUT /sizes |

### Sprint 4 — Navigácia & interakcia
| Funkcia | Detail |
|---------|--------|
| **Fill Handle** ★★★★★ | Modrý rohový štvorček výberu; drag nadol/hore/doprava; `inferFillSeries()` pre číselné sekvencie (1,2,3→4,5,6) a cyklický copy pre text; formula fill cez paste endpoint s relatívnym posunom |
| **Ctrl+Arrow** | Excel-like skok: ak neprázdna → koniec bloku; ak prázdna → ďalšia neprázdna; platí aj pre Shift+Ctrl+Arrow |
| **Ctrl+A** | Druhý Ctrl+A zruší výber (predtým vždy re-select all) |
| **Freeze First Column** | Toggle "⬛ Freeze col" v status bare; CI=0 bunky `sticky left:41px`; persistované cez /sizes (`SheetSizes.freezeFirstCol`) |
| **Tab / Shift+Tab** | ✅ Bolo už implementované v existujúcom kóde |
| **Enter → ide dolu** | ✅ Bolo už implementované (editovanie aj navigácia) |
| **Ctrl+Home / Ctrl+End** | ✅ Bolo už implementované |

---

## 🔶 Na urobenie — ĽAHKÉ (frontend only, 1–3 dni)

### UX & Navigácia
| # | Funkcia | Hodnota | Poznámky |
|---|---------|---------|----------|
| 1 | **Row numbers kliknutie** — klik na číslo riadku vyberie celý riadok | ★★★☆☆ | Jeden handler v SheetRow |
| 2 | **Shift+klik na header** — roztiahnutie výberu stĺpca | ★★★☆☆ | |
| 3 | **Delete/Backspace** — zmazanie obsahu selected buniek (bez confirm) | ★★★★☆ | Jedno volanie clearSelectedCells |
| 4 | **Escape** — zrušenie výberu | ★★☆☆☆ | `setSelection(null)` |

### Formátovanie & zobrazenie
| # | Funkcia | Hodnota | Poznámky |
|---|---------|---------|----------|
| 5 | **Borders** — ohraničenie buniek (thin/thick/none) | ★★★★☆ | CSS border na td; uložiť do CellFormat |
| 6 | **Merge cells** — zlúčiť selected bunky | ★★★☆☆ | `colSpan`/`rowSpan`; treba backend support |
| 7 | **Conditional formatting** — farba bunky podľa hodnoty (napr. > 0 = zelená) | ★★★☆☆ | Frontend only pravidlá |
| 8 | **Strikethrough** | ★★☆☆☆ | `textDecoration: line-through` v CellFormat |
| 9 | **Freeze first row (data row)** | ★★★☆☆ | Sticky CSS na `tr:first-child tbody` |

### Import / Export
| # | Funkcia | Hodnota | Poznámky |
|---|---------|---------|----------|
| 10 | **Copy as Markdown table** | ★★☆☆☆ | Clipboard z selection, žiadny backend |
| 11 | **Print view** | ★★☆☆☆ | CSS @media print |

---

## 🔴 Stredne ťažké (1–2 týždne)

| # | Funkcia | Hodnota | Poznámky |
|---|---------|---------|----------|
| 12 | **Named ranges** — pomenovanie oblasti (napr. `=SUM(Revenue)`) | ★★★☆☆ | Backend + formula eval |
| 13 | **Data validation** — dropdown zoznam, min/max, regex | ★★★★☆ | CellFormat + UI |
| 14 | **Charts** — bar/line/pie z selected dát | ★★★★★ | recharts knižnica |
| 15 | **Multi-sheet formulas** — `=Sheet2.A1` | ★★★☆☆ | Backend formula eval |
| 16 | **Komentáre k bunkám** | ★★★☆☆ | Nová DB tabuľka + hover UI |
| 17 | **Zoom** | ★★★☆☆ | CSS scale + toolbar slider |
| 18 | **Sheet tabs farba / ikona** | ★★☆☆☆ | |

---

## Archív — Zrušené / Odložené

| Funkcia | Dôvod |
|---------|-------|
| Fill Left | Nízka priorita; Fill Down/Right pokrýva 95% use cases |
| Freeze multiple rows | Komplexný layout; zatiaľ len freeze first col |

---

## Technický dlh

- `void fc1` v `fillDragExecute` — implementovať Fill Left
- Fill Handle: pridať fill up (reverse sequence)
- `inferFillSeries`: pridať detekciu dátumových sérií (po dňoch, mesiacoch)
- Status bar aggregate: jednobunkový výber zobrazuje len hodnotu, nie agregát — OK
