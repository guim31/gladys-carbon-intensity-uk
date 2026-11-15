# Carbon Intensity UK

Wie sauber der britische Strom ist, jetzt und in den nächsten 24 Stunden, aus
der offiziellen [Carbon Intensity API](https://carbonintensity.org.uk) von NESO
(National Energy System Operator, früher National Grid ESO). Für ganz
Großbritannien, eine Region oder deine Postleitzahl. Diese Integration ist
nicht mit NESO verbunden.

## Überblick

Für jede verfolgte Zone (Großbritannien, Region, Postleitzahl) legt die
Integration ein Gerät an mit:

- der **CO₂-Intensität** des Stroms der laufenden halben Stunde in gCO₂/kWh
  und dem **Index** von NESO (sehr niedrig → sehr hoch);
- dem **Strommix**: Anteil von Wind, Solar, Kernkraft, Gas, Importen,
  Biomasse, Wasserkraft, Kohle und sonstigen Quellen, dazu der CO₂-arme und der
  erneuerbare Anteil;
- dem **besten Zeitfenster** der nächsten 24 Stunden: wann der sauberste
  Zeitraum der gewählten Länge (standardmäßig 3 Stunden) beginnt, in wie vielen
  Minuten, und seine mittlere Intensität.

Dazu: ein Dashboard-Widget mit der 24-Stunden-Prognosekurve, zwei
Szenen-Auslöser („CO₂-Index wird niedrig“, „Bestes Zeitfenster beginnt“) und
eine Szenen-Aktion, die das beste Zeitfenster beliebiger Länge findet, um die
Spülmaschine zu starten oder das Auto zu laden, wenn das Netz am saubersten
ist.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Gladys muss `api.carbonintensity.org.uk` im Internet erreichen. Weder Konto
  noch Schlüssel: Die Daten sind offen, unter der Lizenz CC BY 4.0.
- Die Zonen liegen in Großbritannien (England, Schottland, Wales):
  Nordirland deckt die API nicht ab.

## Konfiguration

1. Installiere die Integration (**Integrationen → Von GitHub installieren**,
   dann die Adresse des Repositorys).
2. Im Tab **Konfiguration**:
   - **Sprache der Namen**: Sprache der Geräte- und Funktionsnamen (beim
     Hinzufügen festgelegt) und der Texte für Szenen;
   - **Ganz Großbritannien**: ein Gerät für die landesweiten Werte
     (standardmäßig aktiv);
   - **Regionen**: jede der 14 Regionen der Verteilnetze, dazu England,
     Schottland und Wales;
   - **Postleitzahlen**: bis zu fünf britische Postleitzahlen, durch Kommas
     getrennt. Nur der erste Teil zählt (`RG10` für `RG10 9AB`): Die API leitet
     die Region ab. Deine vollständige Postleitzahl wird nie gesendet;
   - **Länge des besten Zeitfensters**: von 30 Minuten bis 6 Stunden.
3. Speichere und füge die Geräte im Tab **Erkennung** hinzu.

### Schaltfläche „Verbindung testen“

Liest alle Zonen auf einmal und zeigt ihre aktuelle Intensität, oder was
schiefging (keine Antwort, der API unbekannte Postleitzahl, Text, der keine
Postleitzahl ist).

## Geräte

### CO₂-Intensität (eines pro Zone)

| Funktion                              | Wert                                                     |
| ------------------------------------- | -------------------------------------------------------- |
| CO₂-Intensität                        | gCO₂/kWh der laufenden halben Stunde                     |
| CO₂-Index (1 bis 5)                   | 1 sehr niedrig, 2 niedrig, 3 mittel, 4 hoch, 5 sehr hoch |
| CO₂-Index                             | derselbe Index als Wort                                  |
| CO₂-armer Anteil, erneuerbarer Anteil | %                                                        |
| Wind-, Solar-, Gasanteil…             | % jeder Quelle, gerundet                                 |
| Beginn des besten Zeitfensters        | Uhrzeit, zum Beispiel `03:00`                            |
| Bestes Zeitfenster in                 | Minuten, auf 5 aufgerundet, 0 sobald es begonnen hat     |
| Intensität des besten Fensters        | sein Mittelwert in gCO₂/kWh                              |

Die Intensität ist die **Prognose** von NESO für die laufende halbe Stunde: Die
API hat keinen Messwert für Regionen und keinen für die laufende halbe Stunde.
„CO₂-arm“ zählt Wind, Solar, Wasserkraft, Biomasse und Kernkraft; Importe und
„Sonstige“ zählen weder dazu noch dagegen.

## Widget

**CO₂-Prognose** zeigt für die in den Einstellungen gewählte Zone
(standardmäßig die erste): die aktuelle Intensität und den Index, den Beginn
des besten Zeitfensters, die Prognosekurve der nächsten 24 Stunden mit
markiertem besten Fenster und aktueller Uhrzeit, und den Strommix der halben
Stunde als Balken. Zwei Einstellungen blenden das beste Fenster und den Mix
aus.

## Szenen

### CO₂-Index wird niedrig (Auslöser)

Löst aus, wenn der Index einer Zone von mittel (oder schlechter) auf niedrig
oder sehr niedrig fällt. Filter: die Zone, der erreichte Index. Variablen:
`level` (`very_low`, `low`), `index` (1, 2), `index_label`, `intensity`,
`zone`.

### Bestes Zeitfenster beginnt (Auslöser)

Löst aus, wenn die laufende halbe Stunde das sauberste Zeitfenster der
nächsten 24 Stunden eröffnet, für die in der Konfiguration eingestellte Länge,
einmal pro Fenster. Filter: die Zone. Variablen: `duration_minutes`,
`average_intensity`, `end_time`, `zone`. In einer Zone, die bei 0 g/kWh bleibt
(oft Südschottland), sind alle Fenster gleich sauber: Der Auslöser kommt am
Ende jedes Fensters erneut. Das Fenster wird jede halbe Stunde auf einem
mitlaufenden Horizont neu gesucht: Ein saubereres Fenster, das hinzukommt, kann
das auf den Geräten angekündigte ersetzen, bevor es beginnt.

### Bestes Zeitfenster finden (Aktion)

Wähle eine Zone und eine Länge: Die Aktion liefert `start_time`, `end_time`,
`minutes_until` und `average_intensity` an die folgenden Aktionen der Szene,
etwa um dir „Waschmaschine um 02:30 starten“ zu schicken (wähle sie in der
Variablenliste des Szenen-Editors).

## Szenen-Beispiele

- Jeden Abend um 20 Uhr **Bestes Zeitfenster finden** für 2 Stunden, dann
  „Beste Zeit für die Spülmaschine:“ mit der Startzeit aus der Variablenliste
  senden.
- **Bestes Zeitfenster beginnt** → die Steckdose der Wallbox einschalten;
  eine geplante Szene schaltet sie morgens aus.
- **CO₂-Index wird niedrig** → den Warmwasserspeicher einschalten, mit einer
  Bedingung auf die Uhrzeit.

## Grenzen

- Daten im Halbstundentakt: Die Integration liest jede Zone einmal pro halbe
  Stunde (zwei Abrufe für Großbritannien, einer für eine Region oder
  Postleitzahl), nur wenn ihr Gerät hinzugefügt oder ihr Widget angezeigt ist.
  Die API verlangt keinen Schlüssel und nennt kein Kontingent; sie wird mit
  dieser Zurückhaltung genutzt.
- Ist die API nicht erreichbar, folgen die Geräte der letzten
  48-Stunden-Prognose, und der Konfigurationsbildschirm zeigt die nicht
  lesbaren Zonen.
- Die Uhrzeiten sind in der Zeitzone von Gladys.

## Fehlerbehebung

- **„Nicht lesbar: RG10“**: Die API kennt die Postleitzahl nicht oder antwortet
  nicht. Die Schaltfläche **Verbindung testen** sagt, was zutrifft.
- **Kein Gerät in der Erkennung**: Keine Zone ist ausgewählt; aktiviere
  Großbritannien oder wähle eine Region oder eine Postleitzahl.
- Protokolle: Die Integration protokolliert ihren Start, die verfolgten Zonen
  und Fehler. Für Details setze die Umgebungsvariable `LOG_LEVEL=debug`.

## Danksagung

Daten: Carbon Intensity API von NESO, CC BY 4.0 — „Carbon Intensity data from
NESO“. API-Dokumentation:
<https://carbon-intensity.github.io/api-definitions/>. Diese Integration ist
nicht mit NESO verbunden.
