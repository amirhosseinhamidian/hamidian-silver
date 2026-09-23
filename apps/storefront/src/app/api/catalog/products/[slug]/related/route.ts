import { NextResponse } from 'next/server';

import { getPublicRelatedProducts } from '@/lib/catalog/public-catalog';

type RouteContext = Readonly<{ params: Promise<{ slug: string }> }>;

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const searchParams = new URL(request.url).searchParams;
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '8');
  const result = await getPublicRelatedProducts(slug, page, pageSize);
  return NextResponse.json(result);
}
