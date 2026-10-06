/**
 * Standard High-Density Code 128 (Subset B) Barcode Generator
 * Generates crisp, standardized vector SVG barcode patterns readable by 
 * 1D optical laser scanners, 2D CCD/camera scanners, and mobile devices.
 */

// Code 128 Patterns (bar, space, bar, space, bar, space widths)
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', // 100-102
  '211412', // 103 Start A
  '211214', // 104 Start B
  '211232', // 105 Start C
  '2331112' // 106 Stop
];

export interface BarcodeResult {
  pattern: string; // '1' = bar, '0' = space
  totalWidth: number;
  text: string;
}

/**
 * Encodes ASCII text into standard Code 128 (Subset B)
 */
export function encodeCode128(text: string): BarcodeResult {
  const clean = text.trim() || 'RECEIPT';
  const START_B = 104;
  const STOP = 106;

  let checksum = START_B;
  const indices: number[] = [START_B];

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    // ASCII 32 to 126 map to values 0 to 94 in Code 128 B
    const val = code >= 32 && code <= 126 ? code - 32 : 0;
    indices.push(val);
    checksum += val * (i + 1);
  }

  const checkIndex = checksum % 103;
  indices.push(checkIndex);
  indices.push(STOP);

  // Convert pattern widths to bit string ('1' for bar, '0' for space)
  let bits = '0000000000'; // quiet zone (10 modules)

  indices.forEach((symIdx, sIdx) => {
    const pStr = CODE128_PATTERNS[symIdx];
    if (!pStr) return;
    let isBar = true;
    for (let c = 0; c < pStr.length; c++) {
      const width = parseInt(pStr[c], 10);
      bits += (isBar ? '1' : '0').repeat(width);
      isBar = !isBar;
    }
  });

  // Stop character extra final bar
  bits += '11';
  bits += '0000000000'; // quiet zone

  return {
    pattern: bits,
    totalWidth: bits.length,
    text: clean,
  };
}
