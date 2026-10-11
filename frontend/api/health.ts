export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return Response.json({ status: "ok", service: "CellScript Vercel API" }, {
    headers: { "Cache-Control": "no-store" }
  });
}
