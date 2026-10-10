Release-Prüfung des Newsletters, 10. Oktober 2026

Der Newsletter und seine Cockpit-Integration sind analysiert und auf Cockpit-Staging durch den tatsächlichen Versand bis zum Gmail-Posteingang geprüft. Die Settings-Sektionen "Images" und "Writing help" sind entfernt. Die Schreibhilfe einschließlich Server Action, OpenAI-Zugriff und Umgebungsvariablen ist vollständig aus dem Newsletter entfernt. Bild-Uploads über Vercel Blob bleiben verfügbar. Die zusätzliche Statuszeile "How your newsletter reaches the inbox" unter "Email preview" ist ebenfalls entfernt.

Der Production-Release ist als [PR 215](https://github.com/startberlin/cockpit/pull/215) vorbereitet. Production wurde noch nicht veröffentlicht. Seine Health-Antwort bestätigt weiterhin `ec7af4a2663bae8cab6900a667bd8b11d947ecc4`. Die Freigabe und der Production-Workflow bleiben erforderlich.

Die Ausgangsbasis war Cockpit-Main `372083719b6968e875187e9abbfc372392cd0a51`, dessen Dateistand dem Production-Branch entsprach. Der ursprüngliche Arbeitsstand bleibt auf `codex/newsletter-review-snapshot-20261010`, Commit `71427e1`, gesichert. Der Feature-Branch wurde nicht umgeschrieben. [PR 214](https://github.com/startberlin/cockpit/pull/214) brachte die geprüfte Integration, die Berechtigungen und den separat entwickelten Sicherheitsfix nach Main. [PR 216](https://github.com/startberlin/cockpit/pull/216) entfernte anschließend die Schreibhilfe.

Die komplette Staging-Prüfung von Erstellen, Speichern, Upload, Testmail, Planung, Abbruch und Broadcast lief auf dem Anwendungscode `bd0e7477d6cad88d99b7062bc3caf0c3a4822a2f`. Die abschließende Änderung unterstützt zusätzlich Namensplatzhalter ohne Fallback in Testmails. Dafür besteht ein eigener Regressionstest. Die echte Nachprüfung auf Staging `f1cf9f6abbe728b3f140d4fb2c4f6587521a1ca5` bestätigte die Ersetzung ohne verbliebene Platzhalter, die Bilddarstellung und bestandene SPF-, DKIM- und DMARC-Prüfungen. Die Mail liegt im Gmail-Posteingang; ihr HTML umfasst 8.486 Bytes, der Klartext 532 Bytes. Die zusätzlichen Nachprüfungen des endgültigen Release-Stands werden im Production-PR dokumentiert.

Geprüft wurden alle 125 verbleibenden Dateien des Newsletter-Moduls, seiner Routen und seiner E-Mail-Vorlagen einschließlich der Tests. Dazu kommen die gemeinsamen Integrationsdateien und die vorhandenen Release-Workflows. Die Prüfung umfasst Eingabevalidierung und Zugriffsrechte, Datenmodell, Editor, Autosave, Anwesenheit, Bildspeicherung und Versandzustände. Resend-Importe und Analytics wurden ebenfalls geprüft. Unveränderte Cockpit-Funktionen wurden nicht vollständig sicherheitsgeprüft.

Referrals, die bestehenden Mitgliedschaftsregeln und Cockpit-Datenbankschemata bleiben unverändert. Der Newsletter wird in die vorhandene App-Registrierung aufgenommen und erhält eine eigene Berechtigung. Die Erweiterung der Bildrichtlinie gilt ausschließlich für `/newsletter`. Es entstehen keine Newsletter-Inngest-Funktionen. Resend führt geplante Broadcasts aus. Die bestehende Staging-Synchronisierung mit Inngest lief erfolgreich.

Aktive Growth-Mitglieder haben Zugriff. Alle Department-Heads und Co-Leads sowie die Legal-Board-Positionen president, vice_president und head_of_finance können den Newsletter ebenfalls nutzen. Cockpit-Admins behalten Zugriff. Dieselbe Berechtigung schützt den App-Launcher, die Seiten und Server Actions. Die Rollenfälle einschließlich abgewiesener inaktiver Konten sind getestet. Für die Staging-Anmeldung wurde der ausdrücklich genehmigte eigene Benutzer mit Growth-Mitgliedschaft angelegt; es wurden ihm keine Adminrechte zugewiesen.

Die ursprüngliche Newsletter-Migration kollidierte mit der inzwischen veröffentlichten Referrals-Migration `0058`. Diese bleibt unverändert. Die Newsletter-Erweiterungen wurden aus dem Schema mit `npm run db:generate` neu erzeugt. `0059_little_namora` erstellt vier Newsletter-Tabellen. `0060_polite_dragon_man` ergänzt die Versandreservierung. Die Migrationen wurden lokal mit `npm run db:migrate` und `npm run db:check` geprüft und über die autorisierte Staging-Pipeline auf PlanetScale angewendet. Keine Migration wurde manuell bearbeitet.

| Migration | SHA-256, identisch in Repository und Staging-Journal |
| --- | --- |
| `0059_little_namora.sql` | `76cc85c5edc2cecf72d8094dfa5d7dd330397d42c2dfc13f58796bdf7e5a70a4` |
| `0060_polite_dragon_man.sql` | `65613cc11618090f82e2b39616b9659e2f990f03ac86aa415da1065a55289667` |

PlanetScale-Staging enthält `newsletter_issue`, `newsletter_asset`, `newsletter_contact` und `newsletter_issue_editor`. Autosave wurde nach erneutem Öffnen der Ausgabe und mit direkten Datenbankabfragen bestätigt. Die bestehende lokale Cockpit-Datenbank wurde nicht verändert. Lokale Integrationstests liefen auf der isolierten Datenbank `start_newsletter_release_20261010`.

Ein Prozessabbruch vor dem Speichern einer Resend-Referenz konnte zuvor eine Ausgabe dauerhaft in "sending" belassen. Die Versandreservierung wird jetzt nach 15 Minuten als fehlgeschlagen abgeglichen, sofern noch keine Provider-Referenz gespeichert ist. Ein Auftrag mit gespeicherter Resend-Referenz wird niemals allein wegen seines Alters freigegeben. Vier tatsächliche PostgreSQL-Prüfungen bestätigten Zugriffsschutz, die Begrenzung auf eine Ausgabe und den Schutz aktiver beziehungsweise bereits referenzierter Aufträge.

Die Blockauswahl per Maus wird ausgeführt, bevor der Editor seine Auswahl verliert. Mausauswahl eines Bildblocks wurde auf Staging geprüft. Die neue Ebene einer älteren Überschrift bleibt beim Speichern erhalten; der Regressionstest bestätigt Speichern und erneutes Öffnen. Der unbenutzte Blocklisten-Editor und seine vier `@dnd-kit`-Abhängigkeiten wurden entfernt. Ein unbenutzter Resend-Wrapper entfiel ebenfalls. Die Seeds schreiben UTC-Zeitstempel ausdrücklich. Historische interne Notion-Notizen und frühere Arbeitsberichte sind vom öffentlichen Release ausgeschlossen.

In einer frühen QA-Testmail blieb `{{{contact.first_name}}}` stehen, weil der Testversand nur die Form mit `|there` ersetzte. Die abschließende Korrektur unterstützt den einfachen Namensplatzhalter und die Fallback-Formen. Unbekannte Kontaktfelder bleiben unverändert. Der Regressionstest prüft auch Umlaute und die unveränderte Ersetzung von `$&`. Tatsächliche Broadcasts verwenden Resends Personalisierung; die zugestellte Staging-Ausgabe enthält "Hallo Jannik".

| Prüfung | Ergebnis |
| --- | --- |
| Repository-Tests | 479 bestanden, 79 Suites, keine Fehler oder übersprungenen Tests. |
| TypeScript | Vollständige Prüfung ohne Fehler. |
| Biome | Vollständiger Durchlauf nach Entfernung der Schreibhilfe ohne Fehler. 26 Warnungen und zwei Hinweise betreffen bestehenden Cockpit-Code. Geänderte Render-Dateien ohne Befund. |
| Lokaler Produktionsbuild | Auch nach der letzten Platzhalter-Korrektur erfolgreich. Saubere Installation mit Next.js 16.3.8 und React Email 6.9.2. |
| E-Mail-Preview-Server | Die tatsächliche Newsletter-Vorlage liefert nach dem Framework-Patch HTTP 200. |
| Staging-Pipeline | Build mit Tests, Migrationen, Domain-Zuweisung und Inngest-Sync erfolgreich. [Run 38052578913](https://github.com/startberlin/cockpit/actions/runs/38052578913). |
| Staging-Browser | Erstellen, Autosave, erneutes Öffnen, Bilddetails und Markdown-Export erfolgreich. Beide entfernten Settings-Sektionen fehlen. |
| Vorschau | Eigenständige Vorschau sowie die 375-px-Mailvorschau auf Staging funktionieren. Die Mailvorschau hat keinen horizontalen Überlauf. Die lokale Prüfung des Editors bei 390 px und der Vorschau bei 320 px bestand ebenfalls. |
| Bildspeicherung | Upload über den Staging-Editor nach Vercel Blob. Öffentlicher Abruf ohne Sitzung: HTTP 200, `image/png`, 15.949 Bytes. Beschreibung, Caption und Bildlink bleiben gespeichert. |
| Kontakte | 297 Resend-Kontakte und zwei Opt-outs korrekt nach Staging gespiegelt. Nach Segmentabgleich genau ein Mitglied im QA-Segment. |
| Cockpit-Import | Gruppen-Vorschau und Ausführung in Sandbox erfolgreich. Keine Mitgliedergruppe live importiert. |
| Echter CSV-Importpfad | Ein vorhandener QA-Kontakt über dieselbe Newsletter-SDK-Funktion eingereicht. Resend bestätigt completed, total 1, skipped 1, created 0, updated 0, failed 0. |
| Testmail | Über "Send test" direkt an den genehmigten Empfänger. Empfängerfeld funktioniert ohne Segment. Ungültige Adresse wird abgewiesen. Finale Nachricht im Gmail-Posteingang, nicht Spam. |
| Testmail-Inhalt | HTML 8.488 Bytes und Klartext 526 Bytes. Umlaute und Bild vorhanden. Dokumentierter Fallback-Tag durch den Beispielnamen ersetzt. Kein verbliebener Platzhalter. |
| Echte Planung | QA-Ausgabe für 16:15 Europe/Berlin geplant. Provider und Datenbank bestätigen 14:15 UTC. Geplante Ausgabe schreibgeschützt. |
| Abbruch | Über "Cancel send" abgebrochen. Resend bestätigt draft ohne verbleibenden Versandtermin. Cockpit zeigt canceled. |
| Echter Broadcast | Kopie der Ausgabe über "Send now" ausschließlich an das QA-Segment gesendet. Resend und Cockpit bestätigen sent. Analytics meldet eine Zustellung und null Bounces. |
| Broadcast-Inhalt | HTML 8.855 Bytes und Klartext 891 Bytes. "Hallo Jannik", Umlaute und Bild korrekt. Kein verbliebener Platzhalter. |
| Mail-Authentifizierung | Finale Testmail und Broadcast bestehen SPF, DKIM und DMARC im Gmail-Header. |
| Links | Bildlink über Tracking liefert HTTP 302 zum vorgesehenen Ziel. Broadcast enthält List-Unsubscribe und List-Unsubscribe-Post. Der Einstellungslink führt zur Resend-Präferenzseite mit HTTP 200. |
| Analytics | Kontoübersicht und Detailbericht lesen reale Provider-Metriken. Der neue Broadcast erscheint mit einer Zustellung. |
| Zugriffsschutz | Ohne Sitzung liefern Upload und Presence-POST HTTP 401. Die Rollenregeln sind zusätzlich durch Repository-Tests abgedeckt. |

Der reale Versand ging ausschließlich an die vom Benutzer freigegebene private QA-Adresse. Das Standardsegment "Newsletter Subscribers" bleibt leer. Der Versand daran wird vom Preflight blockiert. Es wurden keine bestehenden Verteiler mit Mitgliedern befüllt. Der einzige geplante Staging-QA-Auftrag wurde abgebrochen; die verbleibende Ausgabe wurde bereits zugestellt. Die Präferenzseite wurde geöffnet, aber kein globaler Opt-out ausgelöst. Eine Live-Prüfung der Outlook-Darstellung wurde nicht durchgeführt.

Das QA-Segment dient zum Prüfen des tatsächlichen Broadcast-Pfads. Für normale Testmails werden die gewünschten Empfänger direkt im "Send test"-Dialog eingetragen. Bestehende Segmente lassen sich im Versanddialog auswählen; Erstellen und Umbenennen von Segmenten erfolgen derzeit in Resend. "Add contacts to segment" ordnet alle abonnierten Kontakte des lokalen Spiegels dem konfigurierten Standardsegment zu. Diese Aktion wurde nicht live ausgeführt und sollte nicht zum Pflegen eines kleinen QA-Segments verwendet werden. Das Schreiben und Versenden liegt bei Growth; der Testbenutzer ist keine Voraussetzung für spätere Ausgaben.

Die autorisierte Vercel-Konfiguration betrifft ausschließlich `start-berlin/cockpit`. Secrets wurden über den Browser eingerichtet, ohne sie im Repository oder im Bericht abzulegen. Der Vercel-Connector wurde nicht verwendet.

| Konfiguration | Zustand |
| --- | --- |
| `RESEND_API_KEY` | Vorhandener START-Key als Secret in Production und Preview. |
| `NEWSLETTER_SEND_MODE`, Preview/main | live. Vom Benutzer nach erfolgreichem Test als dauerhafter Staging-Modus bestätigt. |
| `NEWSLETTER_SEND_MODE`, Production | live für das spätere Production-Deployment vorbereitet, ausdrücklich vom Benutzer genehmigt. Kein Production-Deployment ausgelöst. |
| `NEWSLETTER_SEND_MODE`, übrige Preview-Branches | sandbox. Getrennt von Production und vom Main-Override. |
| `NEWSLETTER_STORAGE` | blob in Production und Preview. |
| Standardsegment und Topic | Bestehende Newsletter-Konfiguration in Production und Preview. QA-Segment wurde nur pro Testausgabe ausgewählt. |
| Blob-Variablen | Durch Vercel für den verbundenen Speicher bereitgestellt. |
| OpenAI | Keine Newsletter-Variablen und keine direkte SDK-Abhängigkeit mehr vorhanden. |

Der genehmigte öffentliche Blob-Speicher `cockpit-newsletter` liegt in Frankfurt und ist nur mit Cockpit, Production und Preview, verbunden. Er nutzt den bestehenden Hobby-Tarif. Es wurde kein kostenpflichtiger Tarif aktiviert. Bilder werden öffentlich ausgeliefert und sollten nur veröffentlichbare Newsletter-Motive enthalten.

Der Sicherheitsfix wurde auf ausdrücklichen Wunsch separat durch einen Subagent bearbeitet und als eigener Commit `5aa03d5fe4ea719a208dfaf6158418e7707d50ed` integriert. Next.js ist exakt auf 16.3.8 gesetzt und auch in der E-Mail-Vorschau vereinheitlicht. Sharp 0.35.5 verwendet libheif 1.23.5. Die unbenutzte direkte Abhängigkeit `@vercel/og` ist entfernt. React Email und dessen Preview-UI sind auf die kompatible Version 6.9.2 angepasst.

Die Prüfung des Sicherheitsfixes umfasste erfolgreiche Kontrollaufrufe und reproduzierte SVG-Injektionen vor und nach dem Patch. Die Injektionen veränderten nach dem Patch die Ausgabe nicht mehr. Gültige AVIF-Verarbeitung funktionierte; beschädigte Eingaben wurden abgewiesen. Ein vollständiger nativer RCE-Angriff gegen Cockpit wurde nicht ausgeführt. Das Production-Abhängigkeitsaudit mit beschreibbarem npm-Cache meldet 59 betroffene Pakete: 41 moderate, 18 hohe und keine kritischen. Die ursprünglichen kritischen Next.js-Meldungen fehlen. Weitere bestehende Cockpit-Abhängigkeitsbefunde bleiben dokumentiert. Ein vollständiges Audit einschließlich Entwicklungswerkzeugen enthält zusätzlich zwei kritische Befunde in concurrently/shell-quote; diese liegen außerhalb des Production-Audits und des Next.js-Fixes.

Die Domain `emails.start-berlin.com` wurde gezielt zwischen Cloudflare und Resend abgeglichen. DKIM und der MX-Eintrag für `send.emails` stimmen überein. SPF autorisiert Amazon SES mit `-all`. Die vorhandene DMARC-Richtlinie wird übernommen. Die tatsächlichen Staging-Mails bestätigen SPF, DKIM und DMARC. Es wurden keine DNS-Einträge geändert.

Für die eigene Tracking-Subdomain `links.emails.start-berlin.com` fehlt weiterhin der CNAME auf `links1.resend-dns.com`. Resend zeigt deshalb teilweise fehlgeschlagenes Domain-Tracking. Die getesteten Nachrichten verwenden funktionierende geteilte Resend-Tracking-URLs. Eigene Tracking-URLs sind nicht als fertig eingerichtet bestätigt. Die App zeigt dazu einen Hinweis. Die fehlende eigene Tracking-Subdomain blockiert den getesteten Versand nicht.

Die Release-Pipeline baut den Production-Stand zunächst und prüft ihn. Danach führt sie mit der vorgesehenen Production-Freigabe die Migrationen aus und veröffentlicht erst anschließend die Anwendung auf der Production-Domain. Für den ersten regulären Newsletter muss Growth das endgültige Publikum einschließlich der vorhandenen Einwilligungen bestimmen. Das leere Standardsegment darf nicht mit einem beabsichtigten Empfängerkreis verwechselt werden.

Ein Rückweg bleibt möglich: Die Migrationen sind additive Erweiterungen. Ein Zurückrollen der Anwendung erfordert kein Löschen der Newsletter-Tabellen. Vor einem Rollback müssen inzwischen neu geplante Live-Ausgaben in Resend geprüft und gegebenenfalls abgebrochen werden. Die QA-Prüfung hinterlässt keinen zukünftigen Versandauftrag.
