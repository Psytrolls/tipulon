import { createWorker } from 'tesseract.js';

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

export async function extractBusNumberFromImage(imagePath) {
  try {
    const worker = await getWorker();
    const ret = await worker.recognize(imagePath);
    const text = ret.data.text || '';
    
    // Find all digit groups (allowing optional dashes/spaces)
    // Examples: "12-345-67", "123-45-678", "4215", "1234567"
    const rawMatches = text.match(/\b[0-9]{1,3}[- ]?[0-9]{2}[- ]?[0-9]{2,3}\b|\b[0-9]{3,8}\b/g) || [];
    
    // Clean and normalize candidate numbers
    const cleanCandidates = [...new Set(
      rawMatches
        .map(m => m.replace(/[^0-9]/g, ''))
        .filter(num => num.length >= 3 && num.length <= 8)
    )];

    // Rank candidates: prioritize 7 or 8 digits (standard Israeli plates) or 4 digits (common fleet numbers)
    cleanCandidates.sort((a, b) => {
      // 7 or 8 digit plates first
      const aIsPlate = (a.length === 7 || a.length === 8) ? 1 : 0;
      const bIsPlate = (b.length === 7 || b.length === 8) ? 1 : 0;
      if (aIsPlate !== bIsPlate) return bIsPlate - aIsPlate;
      
      // longer numbers generally preferred over 3 digit noise
      return b.length - a.length;
    });

    const bestCandidate = cleanCandidates[0] || null;

    return {
      rawText: text.trim(),
      detectedNumber: bestCandidate,
      candidates: cleanCandidates,
      confidence: ret.data.confidence
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
