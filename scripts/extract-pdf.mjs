/**
 * extract-pdf.mjs
 * Extracts all text from the matura PDF using pdfjs-dist (no worker needed).
 * Run: node scripts/extract-pdf.mjs
 * Output: data/output_full.txt
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

async function main() {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const pdfPath = join(PROJECT_ROOT, '..', 'bjk_hjk_sjk_katalog_eksterna_matura_2022_2023.pdf');
  const loadingTask = getDocument({ url: pdfPath, disableWorker: true });
  const pdf = await loadingTask.promise;

  console.log(`PDF loaded. Pages: ${pdf.numPages}`);

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    let lineText = '';
    for (const item of textContent.items) {
      lineText += item.str + (item.hasEOL ? '\n' : ' ');
    }
    fullText += `\n--- PAGE ${i} ---\n${lineText}\n`;
  }

  const outPath = join(PROJECT_ROOT, 'data', 'output_full.txt');
  writeFileSync(outPath, fullText, 'utf8');
  console.log(`Saved to ${outPath}. Total chars: ${fullText.length}`);
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
