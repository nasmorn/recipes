# Rezepte

Alle Rezepte an einem Ort: Markdown-Dateien in `rezepte/`, ein Validator und eine
statische Website (Suche, Portionen umrechnen, offline nutzbar, installierbar).

```sh
npm run validate   # alle Rezepte prüfen (Fehler mit Datei:Zeile)
npm test           # Parser-, Rezept- und Umrechnungstests
npm run serve      # bauen und unter http://localhost:8080/ ansehen
```

Keine Abhängigkeiten außer Node ≥ 20. Bei jedem Push prüft und baut GitHub Actions
die Seite, von `main` aus wird sie auf GitHub Pages veröffentlicht.

## Rezeptformat

```markdown
---
portionen: 4            # Pflicht: Basis für die Umrechnung
einheit: Portionen      # optional: Muffins, Liter, Gläser, Scheiben …
geschätzt: true         # optional: Portionenzahl ist geschätzt
quelle: eigenes         # woher: eigenes / Kochbuch S. 214 / Name
url: https://…          # optional: Link zum Original
tags: [vegan, Suppe]    # optional, wird mitgesucht
privat: true            # optional: nicht auf der Website veröffentlichen
---
# Titel

Optionaler Einleitungssatz.

## Zutaten
### Für den Teig          ← optionale Gruppen
* 250 g Mehl, glatt
* 1 - 2 Dotter (etwa 35 g)
* ½ TL Salz
* Prise Salz
* evtl. 1 Spritzer Zitronensaft
* Pfeffer

## Zubereitung

Fließtext, Absätze, Listen.

## Varianten              ← beliebige weitere Abschnitte
```

### Zutatenzeilen

`* [etwa|ca.|evtl.] Menge [Einheit] Zutat[, Notiz | (Notiz)]`

- **Menge:** `2`, `1,5`, `1/2`, `½`, `1 1/2`, `1½`, Bereiche `1 - 2` / `15–20`.
  Ohne Menge (`Salz`, `Prise Salz`) wird beim Umrechnen nichts geändert.
- **Einheiten:** g, kg, mg, ml, cl, dl, l, EL, TL, Msp, Prise, Dose, Bund, Zehe,
  Stück, Stange, Zweig, Scheibe, Becher, Pkg., Flasche, Glas, Tasse, Spritzer,
  Schuss, Handvoll, Blatt, Würfel, Messlöffel, cm (auch Mehrzahl, auch direkt an
  der Zahl: `200g`, `4tl`). `gehäufte EL` geht auch. Prise und Msp bleiben beim
  Umrechnen gleich.
- **Notiz:** alles ab dem ersten `, ` oder `(`. Gramm/Milliliter in der Notiz
  werden mitgerechnet (`1 TL Backpulver (4 g)`), außer mit `à`/`je`
  (`2 Dosen Bohnen (à 480 g abgetropft)`).
- **Fehler** gibt es für amerikanische Einheiten (tbsp, cup, lb … bitte
  umrechnen), unbekannte Einheiten direkt an der Zahl (`5Gg`), `2x480g`,
  kaputte Bereiche, Zeilen ohne `* ` im Zutatenteil und fehlende Portionen.
  Fehlende Zubereitung ist nur ein Hinweis.

## Website

`build.mjs` erzeugt `dist/`: eine Startseite mit Schnellsuche (Titel, Zutaten,
Tags; tippen filtert sofort, ↑/↓ und Enter, `/` fokussiert), eine Seite pro
Rezept mit Portionen-Regler (−/+ oder Zahl eingeben, Tasten `+`/`-`, Esc zurück),
abhakbaren Zutaten und „wach halten“ (Bildschirm bleibt an). Ein Service Worker
speichert die ganze Seite beim ersten Besuch, danach geht alles offline;
über das Manifest lässt sie sich am Handy installieren.
