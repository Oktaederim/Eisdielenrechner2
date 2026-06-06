# Eisdielen-Rechner

Mobile Web-App zum Erfassen und Vergleichen von Eis-Kugelgewichten, Preis je 100 g und Verpackungsdaten.

## Was ist in diesem Ordner?

- `index.html` ist die Startseite der App.
- `app.js` enthält Berechnungen, Speichern, Export, Import und Berichtstexte.
- `styles.css` enthält das Aussehen.
- `manifest.webmanifest`, `service-worker.js` und `icon.svg` machen die App besser nutzbar auf iPhone/iPad.
- Die `.command`-Dateien sind nur für lokales Testen auf dem Mac gedacht und müssen nicht zwingend zu GitHub hochgeladen werden.

## GitHub Pages einrichten

1. Auf GitHub ein neues Repository anlegen, zum Beispiel `eisdielen-rechner`.
2. Die Dateien aus diesem Ordner in das Repository hochladen.
3. In GitHub das Repository öffnen.
4. Auf `Settings` gehen.
5. Links auf `Pages` gehen.
6. Bei `Build and deployment` als Quelle `Deploy from a branch` wählen.
7. Als Branch `main` und Ordner `/root` auswählen.
8. Speichern.
9. Nach kurzer Wartezeit zeigt GitHub dort eine Adresse an, ungefähr:

```text
https://DEIN-GITHUB-NAME.github.io/eisdielen-rechner/
```

Diese Adresse ist dann deine App-Adresse.

## Auf iPhone und iPad nutzen

1. Die GitHub-Pages-Adresse in Safari öffnen.
2. Unten auf das Teilen-Symbol tippen.
3. `Zum Home-Bildschirm` wählen.
4. Namen bestätigen, zum Beispiel `Eis-Rechner`.

Danach kannst du die App wie eine normale App vom Home-Bildschirm starten.

## Daten, Fotos und iCloud

- Einträge werden im Browser lokal gespeichert.
- Fotos können pro Messung hinzugefügt werden. Sie werden verkleinert gespeichert, damit die Datei handhabbar bleibt.
- `Lokal speichern` speichert den Eintrag zuerst auf dem aktuell genutzten Gerät.
- `iCloud-Sicherung erstellen` erstellt eine Sicherungsdatei mit allen Einträgen und Fotos.
- Diese Sicherungsdatei kann auf iPhone/iPad über die Teilen- oder Dateien-Funktion in iCloud Drive abgelegt werden.
- `Sicherung laden` lädt eine zuvor erstellte Sicherungsdatei und ersetzt die lokalen Einträge durch diese Sicherung.
- `Tabelle exportieren` erstellt eine CSV-Datei für Numbers, Excel oder Google Sheets. Fotos sind darin nicht enthalten, nur die Anzahl der Fotos.

Wichtig: GitHub speichert nicht automatisch deine Messdaten. GitHub stellt nur die App bereit. Deine Messdaten liegen auf dem jeweiligen Gerät im Browser und können zusätzlich per JSON-Datei in iCloud Drive gesichert werden.

## Empfohlener Arbeitsablauf unterwegs

1. App auf iPhone/iPad öffnen.
2. Messung eintragen und Fotos hinzufügen.
3. `Lokal speichern` tippen.
4. Regelmäßig `iCloud-Sicherung erstellen` nutzen.
5. Die Sicherungsdatei in iCloud Drive ablegen.
6. Auf einem anderen Gerät über `Sicherung laden` dieselbe Datei laden.

## Fairer Vergleich

Für vergleichbare Messungen sollten möglichst immer dieselben Bedingungen gelten:

- drei Kugeln: Vanille, Schokolade, Erdbeere
- keine Sahne, Sauce oder Deko
- Gesamtgewicht mit Becher und Löffel messen
- Verpackung insgesamt wiegen und als Gesamtgewicht eintragen
- Messunsicherheiten als Notiz erfassen

## Berechnungen

- Nettogewicht Eis = Gesamtgewicht minus Verpackungsgewicht
- Durchschnitt pro Kugel = Nettogewicht Eis geteilt durch Anzahl Kugeln
- Preis je Kugel = Gesamtpreis geteilt durch Anzahl Kugeln
- Preis je 100 g = Gesamtpreis geteilt durch Nettogewicht mal 100
- Verpackungsanteil = Verpackungsgewicht geteilt durch Gesamtgewicht

## Lokal auf dem Mac testen

Wenn du die App ohne GitHub nur auf deinem Mac testen möchtest:

1. `Eisdielen-Rechner starten.command` doppelklicken.
2. Die App öffnet sich unter `http://localhost:4173/index.html`.
3. Das Terminalfenster offen lassen, solange du testest.
4. Danach `Eisdielen-Rechner stoppen.command` doppelklicken.
