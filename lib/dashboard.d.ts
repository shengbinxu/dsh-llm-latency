/**
 * Self-contained HTML dashboard served at `/llm-latency/`. Plain HTML/CSS/JS;
 * it fetches the same JSON endpoints the REST surface exposes, so there is no
 * client bundle and no slot-prop coupling. Embedded JS deliberately avoids
 * template literals so it survives string interpolation.
 */
export declare function renderDashboardHtml(): string;
