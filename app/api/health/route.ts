// [starter-standar] direkonstruksi; dipakai healthcheck Coolify & ping status online (use-online)
export function GET() {
  return Response.json({ ok: true, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

export function HEAD() {
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
