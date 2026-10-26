# Skyhaven visual target

2026-10-26: The approved target is the 1672 × 941 Environment Library image supplied by the user. The earlier skin-only release retained a different navigation and page composition; this design replaces it.

| Region | Target geometry at 1672 × 941 | Implementation |
| --- | --- | --- |
| Header | full width, about 70px high | castle brand, search, game tabs, source, settings, library menu in one row |
| Primary rail | x14 y74, width236, bottom620 | four gold icon categories, divider, pack families |
| Content toolbar | x258 y74, height64 | Environment Library, Packs, Props, context search, filters |
| Scene viewport | x258 y145, about1043 × 580 | original pack or owned environment preview |
| Inspector | x1310 y145, about345 × 580 | favorite, Overview/Scene/Models/Textures, real metadata, Copy Path, related files |
| Asset dock | x374 y735, about1288 × 185 | one horizontal row, current collection outlined in gold |
| Navigator | x14 y629, about350 × 292 | library map with pack-family markers and source preview controls |

The map and category icon atlas are generated application UI. The map is labeled LIBRARY MAP; it does not represent a real game scene, source asset or geographic location. Its markers select catalog pack families. Models, source scene images, artwork, counts, authors and licenses are never invented to match the example.

The home route opens the environment screen, with the indexed DETAILED Medieval Castle selected when available. Existing game/group/search filters are preserved. Own environment collections and their original files remain alongside store packs. Props/model/texture browsing is bounded and offers More assets; the full catalog is still searchable.

Characters, animations and creatures retain the same shell, original thumbnails, 3D viewer, motion recommendations, loading/cancellation, references and source paths. Owned assets, files, MCP and storage help remain in the top library menu. Shorter screens and mobile reflow; only the desktop layout is fixed to the target composition.

Original media requires the source service ONLINE. Public UI textures do not. Catalog JSON, source hashes, GUIDs, rigs and file API formats are unchanged. The hosted builder allows only four named UI images and the prompt manifest, never source media. Warm-cache previews retry when the source health check becomes ONLINE.

Acceptance evidence must include a rendered screenshot at target resolution, measured region bounds, actual pack and item switching, search focus preservation, game/family filters, copied original paths, favorites/revisit, model/motion replay, offline behavior, narrow desktop and mobile checks. Checks must cover the changed workflow, and both source and public changes must reach main before deployment is reported complete.
