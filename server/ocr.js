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
  // Match standard Israeli plate patterns (e.g. 123-45-678, 12-345-67) or general sequences of 3-8 digits
  const rawMatches = text.match(/\b[0-9]{2,3}[- ][0-9]{2}[- ][0-9]{2,3}\b|\b[0-9]{7,8}\b|\b[0-9]{3,6}\b/g) || [];
  return rawMatches
    .map(m => m.replace(/[^0-9]/g, ''))
    .filter(num => num.length >= 3 && num.length <= 8);
}

export async function extractBusNumberFromImage(imagePath) {
  try {
    const worker = await getWorker();
    const candidateSet = new Set();
    let combinedText = '';

    // Load image with Jimp for intelligent Israeli plate preprocessing
    let jimpImg = null;
    try {
      jimpImg = await Jimp.read(imagePath);
    } catch (e) {
      console.warn('Jimp failed to read image, falling back to raw path:', e.message);
    }

    if (jimpImg) {
      const origW = jimpImg.bitmap.width;
      const origH = jimpImg.bitmap.height;

      // Scale appropriately:
      // If camera photo is huge (>1600px), resize down to 1400px for speed & OCR accuracy
      // If small crop (<400px), upscale 3x for character visibility
      if (origW > 1600 || origH > 1600) {
        if (origW > origH) {
          jimpImg.resize({ w: 1400 });
        } else {
          jimpImg.resize({ h: 1400 });
        }
      } else if (origW < 400 && origH < 400) {
        jimpImg.resize({ w: origW * 3, h: origH * 3 });
      }

      // Pass 1: Yellow-Aware Plate Binarization (Best for Israeli yellow license plates!)
      try {
        const yellowPlateImg = jimpImg.clone();
        yellowPlateImg.scan((x, y, idx) => {
          const r = yellowPlateImg.bitmap.data[idx];
          const g = yellowPlateImg.bitmap.data[idx + 1];
          const b = yellowPlateImg.bitmap.data[idx + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          
          // Israeli plates: yellow background (high R+G, lower B) or bright areas
          if ((r > b + 25 && g > b + 15) || brightness > 115) {
            yellowPlateImg.bitmap.data[idx] = 255;
            yellowPlateImg.bitmap.data[idx + 1] = 255;
            yellowPlateImg.bitmap.data[idx + 2] = 255;
          } else {
            // Dark text -> black
            yellowPlateImg.bitmap.data[idx] = 0;
            yellowPlateImg.bitmap.data[idx + 1] = 0;
            yellowPlateImg.bitmap.data[idx + 2] = 0;
          }
        });

        const buf1 = await yellowPlateImg.getBuffer('image/png');
        const r1 = await worker.recognize(buf1);
        const t1 = r1.data.text || '';
        combinedText += ' ' + t1;
        parseCandidatesFromText(t1).forEach(c => candidateSet.add(c));
      } catch (e1) {
        console.warn('Yellow binarization pass error:', e1.message);
      }

      // Pass 2: High-contrast Grayscale pass (for white plates or fleet numbers on bus body)
      try {
        const grayImg = jimpImg.clone();
        grayImg.greyscale();
        grayImg.contrast(0.6);
        const buf2 = await grayImg.getBuffer('image/png');
        const r2 = await worker.recognize(buf2);
        const t2 = r2.data.text || '';
        combinedText += ' ' + t2;
        parseCandidatesFromText(t2).forEach(c => candidateSet.add(c));
      } catch (e2) {
        console.warn('Grayscale pass error:', e2.message);
      }
    } else {
      // Direct raw recognize if Jimp didn't load
      const rRaw = await worker.recognize(imagePath);
      combinedText = rRaw.data.text || '';
      parseCandidatesFromText(combinedText).forEach(c => candidateSet.add(c));
    }

    const cleanCandidates = [...candidateSet];

    // Priority ranking:
    // 1. Exactly 7 or 8 digits (Standard Israeli license plates: 12-345-67 or 123-45-678)
    // 2. 4 or 5 digits (Bus fleet numbers: e.g. 4215, 8833)
    // 3. Obvious noise at the end
    cleanCandidates.sort((a, b) => {
      const aIsPlate = (a.length === 7 || a.length === 8) ? 1 : 0;
      const bIsPlate = (b.length === 7 || b.length === 8) ? 1 : 0;
      if (aIsPlate !== bIsPlate) return bIsPlate - aIsPlate;

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
