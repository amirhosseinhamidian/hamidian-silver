export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  imageId?: string | null;
  sortOrder: number;
  isActive: boolean;
}
