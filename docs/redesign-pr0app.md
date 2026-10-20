# Plan: pr0.app-Redesign als zweites Design

Ziel: pr0.app-Look als alternatives Design, umschaltbar über einen Slider unten rechts.
Das klassische pr0gramm.com-Design bleibt unverändert erhalten.

## Analyse pr0.app (ego lite, 2026-10-20)

| Aspekt | Wert |
|---|---|
| Grundfarbe | `#161618` (rgb 22,22,24) – identisch zu unserem `--bg` |
| Text | `#fff`, gedämpft `#a7a7a8` |
| Akzent | `#ee4d2e` (= unser `--main`) |
| Link | `#75c0c7` (= unser `--link`) |
| Schrift | Inter Variable 100–900, 16px Basis, Zeilenhöhe 1.3 |
| Top-Nav | 64px, `position: sticky`, `backdrop-filter: blur(120px)`, `rgba(2,3,6,.6)` |
| Top-Nav Grid | `1fr auto 1fr` – Logo links, Mitte Filter/sfw/Suche/Erstellen, rechts Mail+User |
| Sidebar | 288px, sticky, eigene Spalte |
| Sidebar-Inhalt | Tabs beliebt/neu/müll, Nav mit Icons, Lesezeichen-Sektion, Sammlungen-Sektion, Footer-Links |
| Grid | CSS-Grid, quadratische Kacheln ~128px, `gap: 4px`, füllt die Breite |
| Item | Bild max. 1052px mittig, Aktionsleiste darunter, Meta-Zeile, Tag-Chips, Kommentare |
| Mobil | Top-Nav mit Icon-Logo + Burger, Bottom-Tab-Bar (Beliebt/Neu/Müll/Abos) |

## Architektur

Design ist reines CSS-Thema, per `html[data-design]` geschaltet. Kein Server-Prop,
kein dynamisches Rendering, kein Flash (Inline-Script im `<head>` setzt das Attribut
vor dem ersten Paint aus `localStorage`).

```
html[data-design="classic"]  → bestehendes Design (unverändert)
html[data-design="app"]      → pr0.app-Look (design-app.css)
```

## Dateien

| Datei | Art | Inhalt |
|---|---|---|
| `app/src/lib/design.ts` | neu | Design-Konstanten, Storage-Key, `readDesign`/`writeDesign` |
| `app/src/components/DesignToggle.tsx` | neu | Slider unten rechts |
| `app/src/components/AppNav.tsx` | neu | pr0.app-Top-Nav |
| `app/src/components/AppSidebar.tsx` | neu | pr0.app-Sidebar |
| `app/src/app/design-app.css` | neu | alle App-Design-Regeln, gescoped auf `html[data-design="app"]` |
| `app/src/app/layout.tsx` | geändert | Inline-Script, neue Shell-Elemente, `design-app.css` |
| `app/src/components/ItemView.tsx` | geändert | `.item-actions`-Wrapper, Icon-Buttons, `von`-Klasse |
| `app/src/app/globals.css` | geändert | `.item-actions` = `display: contents` im Classic-Modus |

## Umsetzung

1. `design.ts` + `DesignToggle` – Slider mit zwei Labels, persistiert in `localStorage`.
2. `layout.tsx` – `data-design` auf `<html>`, Inline-Script, `<AppNav>`, `<AppSidebar>`.
3. `design-app.css` – Grid-Layout (288px Sidebar + Content), Top-Nav, Sidebar, Grid, Item.
4. `AppSidebar` – Tabs, Nav, Lesezeichen (`bookmarks.get`), Sammlungen (`collections/get`), Footer.
5. `AppNav` – Logo, Filter-Button, sfw-Dropdown, Suche, Erstellen, Mail, User.
6. `ItemView` – `.item-actions` (Vote + Fav + Share/Download/Report-Icons), Meta-Zeile umsortiert.
7. `Profile` – Banner, Tabs, Stats-Spalte per CSS.
8. Verifikation: `pnpm type-check`, `pnpm build`, Browser-QA (ego lite) in beiden Designs.

## Nicht-Ziele

- Keine neuen Backend-Endpunkte.
- Kein Umbau der klassischen Styles (nur `display:contents`-Wrapper).
- pr0.app-Features ohne Gegenstück in unserem Board (pr0TV, Gamekeys, Kalender) → kein Link.
