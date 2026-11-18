# Data processing and editorial review

## Measurement purpose and limits

The purpose is to understand which network roles receive requests and which distribution channels people use, so START can maintain a useful partner jobboard. The proposed basis for the limited server-side processing is legitimate interests under GDPR Article 6(1)(f), with necessity and balancing documented here: aggregate service usage informs editorial maintenance; no cross-site tracking, advertising profiles, candidate identities or behavioural histories are created. Before public operation, the controller must verify this assessment against the actual hosting/log configuration and provide matching privacy information.

The public application uses no analytics cookies or analytics local/session storage. It does not import Cockpit's PostHog client. Request-specific identifiers only support delivery idempotency; they cannot join a person's visits. Server-side processing still falls within data-protection requirements. "Cookieless" alone is not a legal exemption under section 25 TDDDG.

Only a successfully resolved full-document request is counted as a page request. Recognisable bots, HEAD, prefetch, internal preview and RSC requests are excluded. Remaining counters are requests, not verified people or visible impressions. A redirect count does not establish a submitted application or a shared message. The actual click-through destination can be blocked by the browser, and automated traffic may remain despite filtering.

Sources are explicit allowlisted codes, not identity or arbitrary UTMs. A missing source stays direct/unknown according to the public route; no previous visit is reconstructed. Search terms, IPs and full referrers are not analytics dimensions. Native sharing and copying remain unmeasured.

The public server retries transient telemetry failures within a bounded time using the same event ID. Exhausted attempts are logged as an operational failure without the request payload. Counters are best-effort and must not be presented as complete coverage. No visitor conversion rates or unique-user metrics are derived.

## Retention and separation

- Cockpit stores daily aggregates for 13 calendar months. This is an engineering default, not a statutory period.
- Short-lived delivery IDs are retained for 48 hours; the ingestion window is only 24 hours. Maintenance removes old aggregates and expired delivery identifiers.
- Temporary submission rate-limit metadata is held separately in memory and expires. It serves abuse prevention, not analytics. Per-instance limits need gateway-level reinforcement for horizontally scaled deployments.
- Employer contact details, submission payloads and editorial notes are private operational records, not measurement data. Access requires Jobboard permission. Production operations must define their ongoing retention and data-subject request procedure before public launch; analytics retention does not automatically govern these records.
- Infrastructure access/security logs are separate from application analytics. Hosting defaults, retention and subprocessors must be reviewed before deployment, including query-string and IP logging. Application behaviour alone does not prove the host stores no personal data.

## Editorial safeguards

The full listing must use nondiscriminatory language and accurately describe the employer, contract type and work location. Review compensation disclosures and whether advertising rights were granted. Unpaid and undisclosed are separate states. A minimum-wage exemption is not itself evidence that unpaid work is lawful. For internships, record the duration and relevant rationale in private review notes. For cross-border work, check the actual work countries and applicable local rules instead of assuming German rules are sufficient everywhere.

The system records review confirmation and notes, but cannot certify legal compliance. It does not automatically decide legal exceptions or screen candidates. Substantive updates require publication of a newly reviewed version.

## Primary references checked during implementation planning

- [AGG section 11](https://www.gesetze-im-internet.de/agg/__11.html): nondiscriminatory job advertisements.
- [MiLoG section 22](https://www.gesetze-im-internet.de/milog/__22.html): scope and exceptions for internships.
- [BBiG section 26](https://www.gesetze-im-internet.de/bbig_2005/__26.html): other training relationships.
- [EU Directive 2023/970](https://eur-lex.europa.eu/eli/dir/2023/970/oj/eng), Article 5: pay information for applicants; do not assume a universal salary-in-every-ad rule from this text.
- [Bundestag, 16 July 2026](https://www.bundestag.de/presse/hib/kurzmeldungen-1195086): then-current German implementation process; this historical source does not establish the law on a future publication date.
- [TDDDG section 25](https://www.gesetze-im-internet.de/ttdsg/__25.html).
- [DSK guidance on digital services](https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/publikationen/DSK/2024/2024_DSK-OH_Digitale-Dienste.pdf).

No payment integration, candidate file processing, newsletter subscription or job alerts are active in v1.


## Company icons

The Cockpit server requests the icon for the registrable domain of the employer website saved in the company profile. Icon Horse receives that domain and the Cockpit server IP. It records the lookup time and result and deletes log rows older than 90 days. The visitor's IP and cookies stay out of the request, as do the original website path and application links. The public website uses the employer website in the active publication snapshot. Missing icons or a provider outage display a local company symbol. Icon Horse describes use for identifying a company and provides the service without an uptime guarantee. [Icon Horse privacy and terms](https://icon.horse/privacy.html)
