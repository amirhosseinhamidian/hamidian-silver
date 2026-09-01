export interface Media {
  id: string;
  storageKey: string;
  originalName?: string | null;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  sizeBytes: number;
  altText?: string | null;
}
