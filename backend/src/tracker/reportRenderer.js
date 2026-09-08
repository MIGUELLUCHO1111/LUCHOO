import fs from 'fs';
import puppeteer from 'puppeteer-core';

// Genera el PDF y la imagen del reporte de turno a partir del mismo HTML
// (mismo diseño, dos salidas) usando el Chrome/Edge que ya esté instalado
// en la máquina -- así no hace falta descargar un Chromium aparte
// (puppeteer-core no trae uno). PDF_CHROME_PATH en el .env permite fijarlo
// a mano si la detección automática no aplica (ej. en el servidor de
// producción).
const CANDIDATE_PATHS = [
  process.env.PDF_CHROME_PATH,
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

function findBrowserExecutable() {
  const found = CANDIDATE_PATHS.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      'No se encontró un navegador Chrome/Edge instalado para generar el PDF/imagen del reporte. ' +
        'Define PDF_CHROME_PATH en el .env apuntando al ejecutable.',
    );
  }
  return found;
}

/**
 * @param {string} html - documento completo a renderizar
 * @param {{width?: number}} [options]
 * @returns {Promise<{pdfBuffer: Buffer, pngBuffer: Buffer}>}
 */
export async function renderReportOutputs(html, { width = 1000 } = {}) {
  const executablePath = findBrowserExecutable();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    // Altura inicial angosta a propósito: el contenido real (pocas o muchas
    // unidades) define el alto final, en vez de dejar un documento con una
    // página de tamaño carta llena de espacio en blanco cuando el turno
    // trae pocas lecturas.
    await page.setViewport({ width, height: 200 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ width, height: contentHeight });

    const pdfBuffer = await page.pdf({ printBackground: true, width: `${width}px`, height: `${contentHeight}px` });
    const pngBuffer = await page.screenshot({ type: 'png', fullPage: true });

    return { pdfBuffer, pngBuffer };
  } finally {
    await browser.close();
  }
}
