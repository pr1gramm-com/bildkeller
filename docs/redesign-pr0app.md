# App-Design: Referenz und Abweichungen

Stand: 2026-10-20. Der aktuelle Livevergleich und die offene Abnahme stehen in
[parity-plan.md](parity-plan.md). Die frühere Beschreibung war kein Beleg für 1:1-Parität.

Bildkeller bietet Classic und App über `html[data-design]`; die Auswahl bleibt lokal
persistiert. Beide verwenden dieselbe API und dieselben Konten/Inhalte.

Im erneuten Livevergleich mit ego-lite und agent-browser beobachtet und angeglichen:

| Eigenschaft | Referenzwert |
|---|---|
| Schrift | Sans-Serif, 16 px, Zeilenhöhe 1.3 |
| Desktopheader | 64 px |
| Mobilheader | 48 px |
| Sidebar | 240 px bis 1999 px; 288 px ab 2000 px |
| Mobilansicht | unter 640 px |
| Desktopgrid | quadratische Kacheln, 4 px Abstand, 8 px Außenabstand |
| Beitrag | inline unter der angeklickten Kachelreihe |
| Beitrags-URL | Feed und Suchbegriffe bleiben erhalten |
| Best of | beliebter Feed mit Mindestscore 600 |
| Lesezeichen | benannte Suchen/Feeds |
| Profilbutton | öffnet Profil-/Einstellungsmenü |

Die alte Behauptung, pr0.app öffne Beiträge auf einer separaten Detailseite,
war falsch. Auch die Referenz fügt den Beitrag in den Stream ein.

Eigene Marken, Icons und Inhalte bleiben erhalten. Noch offene Funktionen und
Darstellungsunterschiede dürfen nicht als vollständige Parität ausgewiesen werden.
