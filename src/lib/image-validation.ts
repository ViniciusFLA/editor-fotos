const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Formato invalido. Use PNG, JPG ou WEBP.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Arquivo muito grande. Limite: 20 MB.';
  }
  return null;
}
