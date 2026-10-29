# Supported conversion routes

319 explicit input/output pairs. Aliases: JPEG → JPG, TIF → TIFF, AIF → AIFF, HTM → HTML, MPEG → MPG, HEIF → HEIC, TGZ → TAR.GZ.

| Input | Outputs | Engine |
|---|---|---|
| JPG | PNG, WEBP, GIF, TIFF, BMP, ICO, AVIF, PDF | imagemagick |
| PNG | JPG, WEBP, GIF, TIFF, BMP, ICO, AVIF, PDF | imagemagick |
| WEBP | JPG, PNG, GIF, TIFF, BMP, ICO, AVIF, PDF | imagemagick |
| GIF | JPG, PNG, WEBP, TIFF, BMP, ICO, AVIF, PDF | imagemagick |
| TIFF | JPG, PNG, WEBP, GIF, BMP, ICO, AVIF, PDF | imagemagick |
| BMP | JPG, PNG, WEBP, GIF, TIFF, ICO, AVIF, PDF | imagemagick |
| ICO | JPG, PNG, WEBP, GIF, TIFF, BMP, AVIF, PDF | imagemagick |
| AVIF | JPG, PNG, WEBP, GIF, TIFF, BMP, ICO, PDF | imagemagick |
| HEIC | JPG, PNG, WEBP, GIF, TIFF, BMP, ICO, AVIF, PDF | imagemagick |
| SVG | JPG, PNG, WEBP, GIF, TIFF, BMP, ICO, AVIF, PDF | imagemagick |
| MP3 | WAV, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| WAV | MP3, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| FLAC | MP3, WAV, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| M4A | MP3, WAV, FLAC, AAC, OGG, OPUS, AIFF | ffmpeg |
| AAC | MP3, WAV, FLAC, M4A, OGG, OPUS, AIFF | ffmpeg |
| OGG | MP3, WAV, FLAC, M4A, AAC, OPUS, AIFF | ffmpeg |
| OPUS | MP3, WAV, FLAC, M4A, AAC, OGG, AIFF | ffmpeg |
| AIFF | MP3, WAV, FLAC, M4A, AAC, OGG, OPUS | ffmpeg |
| WMA | MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| MP4 | MOV, MKV, AVI, WEBM, GIF, MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| MOV | MP4, MKV, AVI, WEBM, GIF, MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| MKV | MP4, MOV, AVI, WEBM, GIF, MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| AVI | MP4, MOV, MKV, WEBM, GIF, MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| WEBM | MP4, MOV, MKV, AVI, GIF, MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| WMV | MP4, MOV, MKV, AVI, WEBM, GIF, MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| MPG | MP4, MOV, MKV, AVI, WEBM, GIF, MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, AIFF | ffmpeg |
| DOC | DOCX, ODT, RTF, TXT, PDF | libreoffice |
| DOCX | ODT, RTF, TXT, PDF, EPUB, FB2, MD, HTML | libreoffice, pandoc |
| ODT | DOCX, RTF, TXT, PDF | libreoffice |
| RTF | DOCX, ODT, TXT, PDF | libreoffice |
| TXT | DOCX, ODT, RTF, PDF | libreoffice |
| XLS | XLSX, ODS, CSV, PDF | libreoffice |
| XLSX | ODS, CSV, PDF | libreoffice |
| ODS | XLSX, CSV, PDF | libreoffice |
| CSV | XLSX, ODS, PDF | libreoffice |
| PPT | PPTX, ODP, PDF | libreoffice |
| PPTX | ODP, PDF | libreoffice |
| ODP | PPTX, PDF | libreoffice |
| PDF | PNG, JPG, TXT | poppler |
| EPUB | FB2, MD, HTML, DOCX | pandoc |
| FB2 | EPUB, MD, HTML, DOCX | pandoc |
| MD | EPUB, FB2, HTML, DOCX | pandoc |
| HTML | EPUB, FB2, MD, DOCX | pandoc |
| ZIP | 7Z, TAR, TAR.GZ | sevenzip |
| 7Z | ZIP, TAR, TAR.GZ | sevenzip |
| TAR | ZIP, 7Z, TAR.GZ | sevenzip |
| TAR.GZ | ZIP, 7Z, TAR | sevenzip |
| RAR | ZIP, 7Z, TAR, TAR.GZ | sevenzip |

## Limits

- PDF text extraction requires embedded text; scanned PDFs need OCR (not included).
- JPEG/BMP/ICO can remove transparency, reduce color depth or flatten animation. Other single-frame outputs use the first frame/page of GIF/TIFF/ICO. GIF/TIFF/PDF retain multiple source pages where the encoder supports them.
- CSV exports the first worksheet only, without workbook formatting.
- Document formatting, embedded assets and fonts may change. Pandoc sandbox blocks references to files outside the explicit input; remote/linked-resource documents may need a self-contained export.
- Archives: no encryption or links; maximum 100,000 entries and 20 GiB expanded content; enough temporary space for extraction and repacking is required.
- RAR input only. No DRM, MOBI/AZW output, CAD/3D, OCR, proprietary project files, or PDF to editable Word.

Run npm run test:matrix and inspect output/matrix/results.json for actual verification, not just this capability list.
