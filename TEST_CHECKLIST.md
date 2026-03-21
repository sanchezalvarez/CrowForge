# Test checklist — Sprint 5 (2026-03-21)

Všetko čo bolo dnes pridané/opravené. Manuálne otestuj každý bod.

---

## 1. Klik na číslo riadku — vyberie celý riadok

- [ ] Klikni na číslo ľubovoľného riadku → celý riadok sa zvýrazní (selection r1=r2=riadok, c1=0, c2=posledný stĺpec)
- [ ] Po kliku je focus na gride (môžeš hneď písať / mazať)
- [ ] Funguje na prvom aj poslednom riadku
- [ ] Funguje aj keď má sheet len 1 stĺpec

---

## 2. Strikethrough

### Tlačidlo v toolbare
- [ ] Toolbar obsahuje tlačidlo S (prečiarknuté) vedľa B / I
- [ ] Klik na tlačidlo nastaví prečiarknutie vybraných buniek
- [ ] Druhý klik na tlačidlo prečiarknutie odstráni
- [ ] Tlačidlo je aktívne (zvýraznené) keď má vybraná bunka strikethrough

### Klávesová skratka
- [ ] `Ctrl+5` zapne/vypne prečiarknutie na vybranom rozsahu
- [ ] Kombinácia funguje aj s viacerými bunkami naraz (range select)

### Kombinácia formátov
- [ ] B + S (tučné + prečiarknuté) sa zobrazia správne
- [ ] I + S (kurzíva + prečiarknuté) sa zobrazia správne

---

## 3. Freeze first row

### Zapnutie/vypnutie
- [ ] Status bar (dole) obsahuje tlačidlo "Freeze row" alebo ekvivalent
- [ ] Po kliknutí sa prvý riadok "zmrazí"
- [ ] Druhý klik zmrazenie vypne

### Správanie pri scrollovaní
- [ ] Pri scrollovaní dole zostáva prvý riadok viditeľný a neprekrýva header
- [ ] Prvý riadok je bezprostredne pod column headerom (žiadna medzera)
- [ ] Číslo riadku (naľavo) prvého riadku tiež ostane sticky — nescrolluje preč
- [ ] Bunky zamrazeného riadku a column header sa neprekrývajú (správny z-index)

---

## 4. Shift+klik na column header — roztiahne výber

- [ ] Vyber ľubovoľnú bunku alebo rozsah buniek
- [ ] Shift+klikni na iný column header → výber sa roztiahne: zachová anchor stĺpec, pridá nový stĺpec, všetky riadky (r1=0, r2=posledný)
- [ ] Funguje aj smerom doľava (klikni na stĺpec pred aktuálnym)
- [ ] Prvý klik na header (bez Shift) stále vyberie celý stĺpec normálne

---

## 5. Borders (ohraničenie buniek)

### Cycling tlačidlo v toolbare (□)
- [ ] Toolbar obsahuje tlačidlo ohraničenia (□ ikona)
- [ ] Prvý klik → thin border (tenká čiara dookola bunky, viditeľná ako box-shadow)
- [ ] Druhý klik → thick border (hrubá čiara)
- [ ] Tretí klik → bez ohraničenia (reset)
- [ ] Tlačidlo cykluje: žiadne → thin → thick → žiadne → …

### Vizuálne
- [ ] Thin border je zreteľne tenší ako thick border
- [ ] Ohraničenie sa zobrazuje ako overlay (box-shadow) — nepresúva obsah bunky

### Viacero buniek
- [ ] Keď vyberieš range a cykluješ border, všetky bunky dostanú rovnaký border
- [ ] Keď má range zmiešané borders, tlačidlo začína od "žiadne" (undefined)

---

## 6. Copy as Markdown

### Klávesová skratka
- [ ] `Ctrl+Shift+M` skopíruje vybraný rozsah do clipboardu ako markdown tabuľku

### Tlačidlo v toolbare
- [ ] Toolbar obsahuje tlačidlo "MD" alebo ekvivalent
- [ ] Klik ho skopíruje rovnako ako Ctrl+Shift+M

### Obsah výstupu
- [ ] Prvý riadok je header s názvami stĺpcov (`| A | B | C |`)
- [ ] Druhý riadok sú oddeľovače (`| --- | --- | --- |`)
- [ ] Ďalšie riadky sú dáta
- [ ] Znak `|` v hodnote bunky je správne escapovaný ako `\|`
- [ ] Skryté stĺpce sa **nekopírujú** (ak sú nejaké skryté v selekcii)

---

## 7. Bugy opravené po code review

### applyFormat cleanup
- [ ] Vypni strikethrough na bunke → znovu ju vyber → formát bunky v DB neobsahuje `{s: false}` (môžeš overiť cez Network tab → PUT /sheets/.../formats)
- [ ] Resetuj border na bunke → v DB nie je `{border: undefined}` alebo `{border: null}`

### Freeze first row — row number sticky
- [ ] Pri scroll dole zostáva číslo "1" (row number) sticky — **netestovalo sa zvlášť, ide o opravu bugu kde sa číslo scrollovalo preč**

### copyAsMarkdown + hidden cols
- [ ] Skry stĺpec B (pravý klik → Hide column)
- [ ] Vyber range A1:C3 a stlač Ctrl+Shift+M
- [ ] V clipboarde je tabuľka len so stĺpcami A a C (B chýba)

---

## Regresia — overiť že nič staré nespadlo

- [ ] Bold / Italic stále funguje (Ctrl+B, Ctrl+I)
- [ ] Text color a background color (tlačidlá v toolbare)
- [ ] Freeze first **column** stále funguje (oddelene od freeze row)
- [ ] Klávesová navigácia (šípky, Tab, Enter, Ctrl+Arrow)
- [ ] Editácia bunky (F2 / priame písanie)
- [ ] Fill handle (ťahanie pravého dolného rohu bunky)
- [ ] Find & Replace (Ctrl+H)
- [ ] Number formatting (%, 0.0, …)
- [ ] Multi-level sort
- [ ] Conditional formatting
