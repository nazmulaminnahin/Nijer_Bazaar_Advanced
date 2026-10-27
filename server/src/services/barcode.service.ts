import bwipjs from 'bwip-js';

/**
 * Real, standards-compliant barcodes generated with BWIPP.
 * CODE128 is used so any characters in our codes survive a scan round-trip.
 */
export async function barcodeSvg(text: string, opts: { scale?: number; height?: number } = {}): Promise<string> {
  return bwipjs.toSVG({
    bcid: 'code128',
    text: String(text),
    scale: opts.scale ?? 3,
    height: opts.height ?? 12,
    includetext: false,
    paddingwidth: 2,
    paddingheight: 2,
  });
}

export async function barcodePng(text: string, opts: { scale?: number; height?: number } = {}): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: String(text),
    scale: opts.scale ?? 4,
    height: opts.height ?? 14,
    includetext: false,
    paddingwidth: 2,
    paddingheight: 2,
  });
}
