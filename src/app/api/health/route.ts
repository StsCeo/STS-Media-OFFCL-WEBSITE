export async function GET() {
  return Response.json({ ok: true, service: "sts-media", phase: 1 });
}
