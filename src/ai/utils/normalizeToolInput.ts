/**
 * Utility function untuk normalisasi input dari tools
 */

export function normalizeToolInput(input: any, fieldName: string): string | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const value = input[fieldName];
  
  if (typeof value !== 'string') {
    return null;
  }

  // Normalisasi: trim, hapus karakter khusus, ubah ke lowercase
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Hapus karakter khusus kecuali alfanumerik dan spasi
    .replace(/\s+/g, ' '); // Normalisasi spasi ganda
}
