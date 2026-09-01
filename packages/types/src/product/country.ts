export interface Country {
  id: string;
  name: string;
  slug: string;
  isoCode: string;
  imageId?: string | null;
  isActive: boolean;
}
