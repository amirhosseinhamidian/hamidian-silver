export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageId?: string | null;
  isActive: boolean;
}
