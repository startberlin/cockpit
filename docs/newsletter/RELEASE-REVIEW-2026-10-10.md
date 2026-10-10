Release-Prüfung des Newsletters, 10. Oktober 2026

Die Prüfung der Newsletter-Implementierung und ihrer Cockpit-Integration ist abgeschlossen. Der lokale Produktionsbuild besteht. Echter Testversand und echter Broadcast-Versand wurden bis zum Gmail-Posteingang geprüft. Eine Produktionsfreigabe wird daraus noch nicht abgeleitet: Die neue Implementierung muss durch Cockpit-Staging laufen, und die vorhandenen kritischen Next.js-Sicherheitsmeldungen müssen im Cockpit-Grundstand bearbeitet werden.

Der vorbereitete Branch heißt `codex/newsletter-release-ready`. Er basiert auf dem aktuellen Cockpit-Main `372083719b6968e875187e9abbfc372392cd0a51`. Production `ec7af4a2663bae8cab6900a667bd8b11d947ecc4` hat denselben Dateistand. Der erneute Abruf beider Referenzen am Ende der Prüfung bestätigte diese Basis. Der vorherige Arbeitsstand einschließlich der nicht eingecheckten Änderungen ist auf `codex/newsletter-review-snapshot-20261010`, Commit `71427e1`, gesichert. Der ursprüngliche Feature-Branch wurde nicht umgeschrieben.

Die neue Basis behält die aktuelle Referrals-App und die Cockpit-Pipelines. Gegenüber Main gibt es keine Änderungen an Referrals, den Mitgliedschaftsregeln, den bestehenden Inngest-Funktionen oder den bestehenden Datenbankschemata des Cockpits. Die gemeinsamen Änderungen registrieren den Newsletter, ergänzen seine Berechtigung und konfigurieren seine Darstellung. Die Bildrichtlinie wird nur unter `/newsletter` erweitert. Der Newsletter fügt keinen Hintergrundjob hinzu; Resend übernimmt die Ausführung geplanter Broadcasts.

Geprüft wurden alle 128 Dateien des Newsletter-Moduls, seiner Routen und der E-Mail-Vorlagen, einschließlich der Tests. Der Durchlauf umfasst Server Actions und ihre Eingabeprüfung, Berechtigungen, Datenmodell, Resend-Zugriffe, Bilder, Editor, Autosave, Anwesenheit, Versandzustände und Analysen. Zusätzlich wurden die gemeinsamen Integrationsdateien und die bestehende Release-Pipeline gelesen. Dies ist keine vollständige Sicherheitsprüfung aller unveränderten Cockpit-Funktionen.

Die ursprüngliche Newsletter-Migration `0058` kollidierte mit der inzwischen veröffentlichten Referrals-Migration des Cockpits. Der Release-Branch behält die veröffentlichte Migration unverändert und erzeugt die Newsletter-Erweiterungen aus dem Schema neu. `0059_little_namora` erstellt die vier Newsletter-Tabellen. `0060_polite_dragon_man` ergänzt die Versandreservierung. Beide Dateien wurden mit `npm run db:generate` erzeugt, über `npm run db:migrate` auf der isolierten lokalen Datenbank angewendet und mit `npm run db:check` geprüft. Keine Migration wurde von Hand verändert.

Ein Prozessabbruch vor dem Speichern einer Resend-Referenz konnte eine Ausgabe dauerhaft im Zustand "sending" hinterlassen. Eine neue Reservierungszeit erlaubt es, solche Ausgaben nach 15 Minuten als fehlgeschlagen zu kennzeichnen. Inhalt und Wiederholungsmöglichkeit über eine Kopie bleiben erhalten. Ein Auftrag mit gespeicherter Provider-Referenz wird niemals allein wegen seines Alters freigegeben. Echte PostgreSQL-Prüfungen bestätigten verweigerten Zugriff, die Begrenzung auf eine Ausgabe, das Ablaufen alter ungesicherter Reservierungen und den Schutz aktiver beziehungsweise bereits referenzierter Aufträge. Der Abgleich läuft beim Öffnen der Ausgabe oder ihrer Liste.

Die Blockauswahl per Mausklick schloss sich teilweise, bevor das Kommando ausgeführt wurde. Die Auswahl wird jetzt ausgeführt, während der Editor seine Auswahl noch hält. Im Browser wurden Bildauswahl mit Enter und das Einfügen eines Trenners per Maus geprüft. Eine ältere Überschrift, die im Editor zum Titel geändert wurde, verlor beim Speichern ihre neue Ebene. Die Speicherung behält jetzt den Titel bei; ein Regressionstest bestätigt Speichern und erneutes Öffnen. Der alte, nicht mehr verwendete Blocklisten-Editor wurde entfernt, ebenso seine vier `@dnd-kit`-Abhängigkeiten und ein unbenutzter Resend-Wrapper. Die Beispiel-Seeds schreiben UTC-Zeitstempel ausdrücklich. Der E-Mail-Kopf trägt einen Titel und explizite Sprach- und Richtungsattribute.

Historische Notion-Notizen und frühere Arbeitsberichte liegen lokal unter `.generated/newsletter-review-references/` und sind vom Release ausgeschlossen. Das verhindert, dass interner Recherchekontext mit dem Anwendungscode veröffentlicht wird. Die README verweist auf diesen aktuellen Bericht.

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige Repository-Tests | 476 bestanden, keine Fehler oder übersprungenen Tests. |
| TypeScript | Vollständige Prüfung ohne Fehler. |
| Biome | Gesamter Durchlauf über 709 Dateien ohne Fehler. 26 Warnungen und zwei Hinweise betreffen den unveränderten Cockpit-Code. Der letzte gezielte Durchlauf über 136 Newsletter- und Integrationsdateien hat keinen Befund. |
| Produktionsbuild | Erfolgreich mit sauber installierten Abhängigkeiten und isolierter Datenbank. Google-Zugangsdaten waren für diesen lokalen Build unbenutzte Platzhalter. |
| Migrationen | Erzeugung, Anwendung auf einer frischen lokalen Datenbank und Konsistenzprüfung erfolgreich. |
| Echte Datenbank | Reservierungsablauf und Zugriffsschutz mit tatsächlichem PostgreSQL geprüft. |
| Browser | Erstellen, Autosave, Vorschau, Bilddetails, Blockauswahl, Testversand, Planung, Abbruch, Kopie und Sofortversand geprüft. Geplante und gesendete Inhalte wurden schreibgeschützt dargestellt. |
| Schmale Ansichten | Editor bei 390 px und Vorschau bei 320 px ohne horizontalen Seitenüberlauf geprüft. Die Browsergröße wurde danach zurückgesetzt. |
| Öffentlicher Bildzugriff | Tatsächlicher Upload über den Newsletter-Endpunkt nach Vercel Blob. Das PNG liefert ohne Sitzung HTTP 200 und `image/png`. |
| Zustellung | Testmail und echter Broadcast befinden sich im Gmail-Posteingang, nicht im Spam. SPF, DKIM und DMARC jeweils bestanden. |
| Nachricht | UTF-8-Umlaute, HTML und Klartext vorhanden. Kein verbliebener Abmelde-Platzhalter. Zugestellte HTML-Größen: 7.690 und 8.064 Bytes. |
| Tracking und Einstellungen | Tracking-Links der Testmail führen per HTTP 302 zum vorgesehenen Ziel. Der echte Broadcast enthält `List-Unsubscribe` und `List-Unsubscribe-Post`; sein Einstellungslink liefert HTTP 200 bei Resend. |
| Planung und Abbruch | Ein echter Auftrag wurde für einen späteren Zeitpunkt geplant und anschließend abgebrochen. Resend bestätigt einen ungesendeten Entwurf ohne Planzeit. |
| Tatsächlicher Broadcast | Resend meldet "sent", eine Zustellung und keinen Bounce. Der lokale Status wechselt nach Aktualisierung ebenfalls zu "sent". |

Alle schreibenden Datenbanktests liefen auf `start_newsletter_release_20261010`. Die ursprüngliche lokale Datenbank wurde nicht geändert. Das Resend-Testsegment enthält genau die vom Benutzer freigegebene private Testadresse. Es wurden keine bestehenden Verteiler befüllt und keine Mitgliedergruppen live importiert. Die realen Nachrichten gingen ausschließlich an die Testadresse. Abmeldung wurde bis zur funktionierenden Einstellungsseite geprüft; ein globaler Opt-out wurde nicht ausgelöst. Optionales OpenAI-Schreiben und Outlook-Darstellung wurden nicht live getestet.

Im Vercel-Projekt `start-berlin/cockpit` wurden über den Browser diese Newsletter-Variablen für Production und Preview eingerichtet. Andere Vercel-Projekte wurden nicht geändert.

| Variable | Zustand |
| --- | --- |
| `RESEND_API_KEY` | Vorhandener lokaler START-Key als Secret in Production und Preview. |
| `NEWSLETTER_SEND_MODE` | `sandbox` in beiden Umgebungen. Die echten Tests verwendeten eine separate lokale Konfiguration mit `live`. |
| `NEWSLETTER_STORAGE` | `blob` in beiden Umgebungen. |
| `RESEND_NEWSLETTER_SEGMENT_ID` | Bestehender Newsletter-Standard aus der lokalen Konfiguration. |
| `RESEND_NEWSLETTER_TOPIC_ID` | Bestehendes Newsletter-Topic aus der lokalen Konfiguration. |
| `BLOB_READ_WRITE_TOKEN` | Von Vercel für den neu verbundenen Speicher eingerichtet. |
| `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY` | Durch die Blob-Verbindung eingerichtet. |

Der genehmigte öffentliche Speicher `cockpit-newsletter` liegt in Frankfurt und ist ausschließlich mit Cockpit, Production und Preview, verbunden. Der vorhandene Hobby-Tarif umfasst 1 GB Speicher und 10 GB Blob-Transfer pro Monat. Hobby hat Nutzungsgrenzen und keine automatische verbrauchsabhängige Mehrabrechnung. Es wurde kein kostenpflichtiger Tarif aktiviert. [Vercel Blob](https://vercel.com/blog/vercel-blob-now-generally-available), [Hobby-Limits](https://vercel.com/docs/plans/hobby).

PlanetScale `start-berlin/cockpit` ist erreichbar. Die Staging-Migrationshistorie endet bei der veröffentlichten Cockpit-Migration `0058`; deren Hash stimmt mit der unveränderten Repository-Datei überein. In Staging bestehen noch keine Newsletter-Tabellen. Die laufende Staging-Anwendung meldet Main `3720837` über `/api/health`. Die neue Newsletter-Version wurde in diesem Durchlauf weder auf Staging noch auf Production veröffentlicht. Vercel-Secrets für die Staging-Datenbank waren im Browser nicht auslesbar. Es wurden keine neuen Datenbankrollen oder Produktionsmigrationen angelegt.

Vor der Produktionsfreigabe sind diese konkreten Schritte offen:

1. Den Newsletter-Branch als Änderung gegen den aktuellen Cockpit-Main prüfen und in die vorhandene Staging-Pipeline übernehmen. Diese baut zunächst, führt danach die Migrationen aus und weist erst dann die Staging-Domain zu. Im Staging zusätzlich `/newsletter`, Speichern, Bild-Upload und einen begrenzten Testversand prüfen. Der allgemeine Health-Endpunkt allein prüft die neuen Tabellen nicht.
2. Die Cockpit-Grundversion von Next.js absichern. `npm audit --omit=dev` meldet auf Main und auf dem Release-Branch dieselben 63 betroffenen Pakete: 41 moderate, 21 hohe und ein kritisches Paket. Der Newsletter fügt keinen Paketbefund hinzu. Next.js `16.2.6` liegt in den betroffenen Bereichen der veröffentlichten AVIF- und ImageResponse-Meldungen. Dies sind belegte Paketmeldungen; ein Angriff gegen das laufende Cockpit wurde nicht getestet. Der Framework-Patch gehört als gesonderte Cockpit-Änderung mit Regressionstests in die Freigabe. [AVIF-Meldung](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), [ImageResponse-Meldung](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).
3. Für den ersten echten Newsletter das endgültige Publikum und dessen Einwilligungen bestätigen. Das konfigurierte Newsletter-Standardsegment ist weiterhin leer. Die Software verhindert einen Versand an ein leeres Segment. Den Versandmodus erst für die ausdrücklich vorgesehene Umgebung auf `live` setzen.

Cloudflare wurde im angemeldeten START-Berlin-Konto gezielt mit Resend abgeglichen. Der DKIM-Schlüssel unter `resend._domainkey.emails` stimmt überein. Der MX-Eintrag für `send.emails` zeigt mit Priorität 10 auf `feedback-smtp.eu-west-1.amazonses.com`. Der zugehörige SPF-Eintrag lautet `v=spf1 include:amazonses.com -all`. Er ist strenger als Resends vorgeschlagenes `~all`, autorisiert aber denselben Versanddienst. Alle drei Einträge sind DNS-only. Die Newsletter-Subdomain übernimmt die vorhandene DMARC-Richtlinie der Hauptdomain mit `p=none` und `sp=none`. Die realen Nachrichten bestehen SPF, DKIM und DMARC.

Ein zusätzlicher Betriebspunkt ist die eigene Tracking-Subdomain `links.emails.start-berlin.com`: In Cloudflare fehlt dieser CNAME, was Resends fehlgeschlagenen Status erklärt. Die getesteten Nachrichten verwenden funktionierende geteilte Resend-Tracking-URLs. Eigene Tracking-URLs sind deshalb nicht als fertig eingerichtet bestätigt. Für sie benötigt die DNS-Zone den CNAME `links.emails` auf `links1.resend-dns.com`, ohne Proxy; danach muss Resend erneut verifizieren. Für den getesteten Versand ist keine DNS-Änderung erforderlich. Es wurden keine DNS-Einträge verändert.

Ein Rückweg bleibt möglich: Der vorherige Arbeitsstand ist gesichert. Die Newsletter-Migrationen sind additive Erweiterungen. Ein Zurückrollen der Anwendung erfordert kein Löschen der neuen Tabellen. Geplante echte Ausgaben sollten vor einem Rollback ausdrücklich in Resend geprüft werden. Der einzige geplante QA-Auftrag wurde bereits abgebrochen.
