import { createWorker } from 'tesseract.js';
import { Jimp } from 'jimp';

let workerInstance = null;

async function getWorker() {
  if (!workerInstance) {
    workerInstance = await createWorker('eng');
    await workerInstance.setParameters({
      tessedit_char_whitelist: '0123456789 -',
    });
  }
  return workerInstance;
}

function parseCandidatesFromText(text) {
  if (!text) return [];
  // Match full plate sequences (e.g. "123-45-678", "12-345-67", "9-222-58", "9-222 56")
  const platePatterns = text.match(/[0-9]{1,3}(?:[- ][0-9]{1,3}){1,3}/g) || [];
  // Match standalone number sequences 3-8 digits
  const generalNumbers = text.match(/\b[0-9]{3,8}\b/g) || [];

  const all = [...platePatterns, ...generalNumbers];
  return [...new Set(
    all
      .map(m => m.replace(/[^0-9]/g, ''))
      .filter(num => num.length >= 3 && num.length <= 8)
  )];
}

export async function extractBusNumberFromImage(imagePath) {
  try {
    const worker = await getWorker();
    const candidateSet = new Set();
    let combinedText = '';

    let jimpImg = null;
    try {
      jimpImg = await Jimp.read(imagePath);
    } catch (e) {
      console.warn('Jimp read warning:', e.message);
    }

    if (jimpImg) {
      const origW = jimpImg.bitmap.width;
      const origH = jimpImg.bitmap.height;

      // 1. Find yellow license plate region (bounding box)
      let minX = origW, maxX = 0, minY = origH, maxY = 0;
      let yellowCount = 0;

      jimpImg.scan((x, y, idx) => {
        const r = jimpImg.bitmap.data[idx];
        const g = jimpImg.bitmap.data[idx + 1];
        const b = jimpImg.bitmap.data[idx + 2];
        // Israeli yellow plate detection: high red/green, lower blue
        if (r > 135 && g > 115 && b < 120 && (r - b) > 35 && (g - b) > 20) {
          yellowCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      });

      // Pass 1: If yellow plate detected, crop directly to plate with generous padding
      if (yellowCount > 30 && maxX > minX && maxY > minY) {
        try {
          const padX = Math.round((maxX - minX) * 0.15);
          const padY = Math.round((maxY - minY) * 0.45); // Generous vertical padding to never clip numbers
          const cropX = Math.max(0, minX - padX);
          const cropY = Math.max(0, minY - padY);
          const cropW = Math.min(origW - cropX, (maxX - minX) + 2 * padX);
          const cropH = Math.min(origH - cropY, (maxY - minY) + 2 * padY);

          const plateCrop = jimpImg.clone().crop({ x: cropX, y: cropY, w: cropW, h: cropH });

          // Scale to ideal height for OCR font recognition (~150px)
          const targetH = 150;
          const scale = targetH / plateCrop.bitmap.height;
          plateCrop.resize({ w: Math.max(200, Math.round(plateCrop.bitmap.width * scale)), h: targetH });

          // Grayscale & high contrast
          plateCrop.greyscale().contrast(0.7);

          const bufPlate = await plateCrop.getBuffer('image/png');

          // Recognize plate with PSM 6 and PSM 7
          await worker.setParameters({ tessedit_pageseg_mode: '6' });
          const rPlate6 = await worker.recognize(bufPlate);
          const tPlate6 = rPlate6.data.text || '';
          combinedText += ' ' + tPlate6;
          parseCandidatesFromText(tPlate6).forEach(c => candidateSet.add(c));

          await worker.setParameters({ tessedit_pageseg_mode: '7' });
          const rPlate7 = await worker.recognize(bufPlate);
          const tPlate7 = rPlate7.data.text || '';
          combinedText += ' ' + tPlate7;
          parseCandidatesFromText(tPlate7).forEach(c => candidateSet.add(c));
        } catch (ePlate) {
          console.warn('Plate crop OCR error:', ePlate.message);
        }
      }

      // Pass 2: Grayscale high contrast pass on whole image (or resized if huge)
      try {
        const fullCopy = jimpImg.clone();
        if (origW > 1400 || origH > 1400) {
          fullCopy.resize({ w: 1200 });
        } else if (origW < 400) {
          fullCopy.resize({ w: origW * 2, h: origH * 2 });
        }
        fullCopy.greyscale();
        fullCopy.contrast(0.65);

        const bufFull = await fullCopy.getBuffer('image/png');
        await worker.setParameters({ tessedit_pageseg_mode: '11' });
        const rFull = await worker.recognize(bufFull);
        const tFull = rFull.data.text || '';
        combinedText += ' ' + tFull;
        parseCandidatesFromText(tFull).forEach(c => candidateSet.add(c));
      } catch (eFull) {
        console.warn('Full copy OCR error:', eFull.message);
      }
    } else {
      // Direct raw fallback
      const rRaw = await worker.recognize(imagePath);
      combinedText = rRaw.data.text || '';
      parseCandidatesFromText(combinedText).forEach(c => candidateSet.add(c));
    }

    const cleanCandidates = [...candidateSet];

    // Priority ranking:
    // 1. 7 or 8 digits (Standard Israeli plates: 12345678 or 1234567)
    // 2. 6 digits (Plates with 1 cut-off digit, e.g. 922258)
    // 3. 4 or 5 digits (Bus fleet numbers: e.g. 4215, 8833)
    // 4. Short 3-digit noise at the very bottom
    cleanCandidates.sort((a, b) => {
      const aIsFullPlate = (a.length === 7 || a.length === 8) ? 1 : 0;
      const bIsFullPlate = (b.length === 7 || b.length === 8) ? 1 : 0;
      if (aIsFullPlate !== bIsFullPlate) return bIsFullPlate - aIsFullPlate;

      const aIsNearPlate = a.length === 6 ? 1 : 0;
      const bIsNearPlate = b.length === 6 ? 1 : 0;
      if (aIsNearPlate !== bIsNearPlate) return bIsNearPlate - aIsNearPlate;

      const aIsFleet = (a.length === 4 || a.length === 5) ? 1 : 0;
      const bIsFleet = (b.length === 4 || b.length === 5) ? 1 : 0;
      if (aIsFleet !== bIsFleet) return bIsFleet - aIsFleet;

      return b.length - a.length;
    });

    const bestCandidate = cleanCandidates[0] || null;

    return {
      rawText: combinedText.trim(),
      detectedNumber: bestCandidate,
      candidates: cleanCandidates
    };
  } catch (err) {
    console.error('OCR recognition error:', err);
    return {
      rawText: '',
      detectedNumber: null,
      candidates: [],
      error: err.message
    };
  }
}
