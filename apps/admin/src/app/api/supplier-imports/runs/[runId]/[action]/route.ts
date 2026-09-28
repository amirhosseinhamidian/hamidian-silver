import { NextResponse } from 'next/server';
import { forwardSupplierImportMutation } from '@/lib/supplier-imports/supplier-imports-bff';

type RouteContext = Readonly<{ params: Promise<{ runId: string; action: string }> }>;

export async function POST(request: Request, context: RouteContext) {
  const { runId, action } = await context.params;
  if (!['pause', 'resume', 'archive'].includes(action)) {
    return NextResponse.json({ message: 'عملیات نامعتبر است.' }, { status: 404 });
  }
  return forwardSupplierImportMutation(
    request,
    `/api/v1/supplier-imports/runs/${encodeURIComponent(runId)}/${action}`,
    'POST',
  );
}
