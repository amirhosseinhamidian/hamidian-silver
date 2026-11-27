export function isCampaignGif(buffer: Buffer): boolean {
  if (buffer.length < 14 || !['GIF87a', 'GIF89a'].includes(buffer.toString('latin1', 0, 6))) {
    return false;
  }

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const pixels = width * height;
  if (!pixels || width > 4096 || height > 4096 || pixels > 8_000_000) return false;

  const colorTableLength = (flags: number) => (flags & 0x80 ? 3 * 2 ** ((flags & 7) + 1) : 0);
  let offset = 13 + colorTableLength(buffer[10]);
  let frames = 0;

  function skipSubBlocks(): boolean {
    while (offset < buffer.length) {
      const bytes = buffer[offset++];
      if (bytes === 0) return true;
      offset += bytes;
    }
    return false;
  }

  while (offset < buffer.length) {
    const marker = buffer[offset++];
    if (marker === 0x3b) return frames > 0 && offset === buffer.length;
    if (marker === 0x21) {
      offset++; // Extension label.
      if (!skipSubBlocks()) return false;
      continue;
    }
    if (marker !== 0x2c || offset + 9 >= buffer.length) return false;

    const left = buffer.readUInt16LE(offset);
    const top = buffer.readUInt16LE(offset + 2);
    const frameWidth = buffer.readUInt16LE(offset + 4);
    const frameHeight = buffer.readUInt16LE(offset + 6);
    if (
      frameWidth === 0 ||
      frameHeight === 0 ||
      left + frameWidth > width ||
      top + frameHeight > height
    ) {
      return false;
    }

    frames++;
    if (frames > 120 || pixels * frames > 160_000_000) return false;
    offset += 9 + colorTableLength(buffer[offset + 8]);
    const codeSize = buffer[offset++];
    if (!(codeSize >= 2 && codeSize <= 8) || !buffer[offset] || !skipSubBlocks()) return false;
  }
  return false;
}
