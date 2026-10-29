# Research record

Observed 2026-10-28. Product descriptions are advertised capabilities, not independent benchmarks or popularity rankings.

- VERT: https://vert.sh/ — direct file entry, format families; local browser conversion plus optional server processing for some video routes.
- UniConverter: https://videoconverter.wondershare.com/ — media format conversion, compression and presets.
- Movavi: https://www.movavi.com/support/how-to/how-to-convert-video.html — add files, select target and convert.
- NCH: https://www.nchsoftware.com/software/converters.html — media, documents, images, archives as separate converter products.
- CoolUtils: https://www.coolutils.com/CoolutilsConverter — mixed document batches and explicit output choices.

## REA evidence and limitations

Evidence `ev_62ce38f4d1d148c5ac0381b403a644a9b0fe5037f09e795e7cb96d6288cfd262`: static inspection of 11 captured VERT JavaScript files, artifact SHA-256 `4b204e0014748139aff1580e3f4cfa6cbecc3ccc756ee5506599df7732cc0698`. Coverage partial; one parse failure. No conversion execution, complete client reconstruction or paid-app internal analysis was established. Separate Chrome launch for passive CDP capture was rejected by approval review with reason "blocked by policy". Playwright successfully inspected the public page.

AIO is an independent implementation using public conversion engines; no proprietary app code or branding is reused.

## Design

User confirmed Apple-inspired neutral surfaces, blue action accent, system typography, one mixed-file queue, per-file formats and a settings drawer. Impeccable seed `44470e20` was run; the user-pinned brief controls the visual system and topology. No generated raster artwork is used. App mark is authored SVG geometry; Windows ICO is rendered from that source.

## Engine configuration evidence

LibreOffice's configuration enums differ: [Writer Link=2 means Never](https://github.com/LibreOffice/core/blob/master/officecfg/registry/schema/org/openoffice/Office/Writer.xcs); [Calc Link=1 means Update never](https://github.com/LibreOffice/core/blob/master/officecfg/registry/schema/org/openoffice/Office/Calc.xcs). Confirmed using Context7 `/libreoffice/core` and upstream schemas. Separate regression assertions cover each profile setting.
