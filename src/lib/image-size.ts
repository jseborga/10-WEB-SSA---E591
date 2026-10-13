/** Lee ancho/alto de la cabecera de PNG, JPEG o WebP sin decodificar la imagen. */
export function readImageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // PNG: IHDR justo después de la firma
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }

  // JPEG: buscar el primer marcador SOFn
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2

    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1
        continue
      }

      const marker = bytes[offset + 1]
      const length = view.getUint16(offset + 2)
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

      if (isSof) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }
      }

      offset += 2 + length
    }

    return null
  }

  // WebP: RIFF....WEBP + VP8 / VP8L / VP8X
  if (bytes.length > 30 && view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])

    if (chunk === 'VP8 ') {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
    }

    if (chunk === 'VP8L') {
      const b = view.getUint32(21, true)
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
    }

    if (chunk === 'VP8X') {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16))
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
      return { width, height }
    }
  }

  return null
}
