# Book scanning

Use **Add recipe → Scan book**. Choose the language printed in the book; automatic mode reads English, Danish, and Dutch. Select up to six photos in reading order. Include every ingredient and instruction page. Clear close-ups help, but avoid cutting off quantities at the page edge.

The recipe photo and text sources are separate choices. Keep the food photograph selected as the recipe image, and turn off **Read text from this photo** for images without recipe text. Automatically rejected text photos are identified after scanning and remain available as recipe images.

Review the combined preview before saving. Missing instruction pages produce a warning and empty instruction steps. Notes printed beside ingredients remain attached to their ingredient, rather than being used as cooking steps. All accepted source text is available under the detected-text disclosure. Existing saved recipes are not rescanned or overwritten.

## Local OCR implementation

The API uses Tesseract with the official `tessdata_best` English, Danish, and Dutch models from revision `e12c65a915945e4c28e237a9b52bc4a8f39a0cec`. Docker downloads these at build time and verifies the committed SHA-256 checksums in `apps/api/ocr-models.sha256`. Models and their license are packaged in the image. Photos are never sent to an external OCR service; normal scanning needs no model download or external credentials.

`MADPLANNER_TESSDATA_DIR` selects the model directory; Docker sets it to `/opt/madplanner/tessdata_best`. The development CLI may omit it to use system models. OCR subprocesses share a 50-second deadline per photo and use at most two OpenMP threads in Docker. Scanning several photos takes longer than one photo.

The pipeline uses EXIF orientation, bounded image enlargement, text coordinates, a sparse-text pass for large titles, and separate cropped column passes for ingredient-only pages. Ingredient paragraphs retain their commentary. Candidate selection prioritises section evidence; the browser combines overlap using ingredient identity, quantities, and recognition confidence. This is deterministic OCR, not a generative recipe-writing model.

## Verification examples

The four user-supplied Fast Food Pizza photographs were tested locally in English. The food-only photo supplied no usable text. The ingredient-page scans produced ten entries each after focused reading; combining all four retained the full title, ten ingredients, and no invented instruction steps. Computer-monitor text above the book did not appear in the combined fields. The photos themselves are not committed to the repository.

Character recognition is still imperfect, particularly with glare, curved pages, clipped quantities, and decorative fonts. Some commentary in this example still requires correction. Recognition confidence is a heuristic rather than a guarantee. Raw source text remains reviewable, and the preview is editable before any recipe is created.

Regression tests use synthetic text layouts for multi-column reading, title and background separation, ingredient notes, photo rejection, overlap handling, language selection, and photo-only controls.

References: [Tesseract model trade-offs](https://tesseract-ocr.github.io/tessdoc/Data-Files), [segmentation and image quality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality).
