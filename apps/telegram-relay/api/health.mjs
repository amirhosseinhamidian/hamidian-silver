const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export function GET() {
  return Response.json(
    {
      ok: true,
      service: 'hamidian-telegram-relay',
    },
    { headers: RESPONSE_HEADERS },
  );
}
