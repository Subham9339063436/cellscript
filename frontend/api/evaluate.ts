import { evaluateWorkbook, type WorkbookRequest } from "../src/lib/evaluator";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 2 * 1024 * 1024) {
      return Response.json({ error: "Request body is too large (maximum 2 MB)" }, { status: 413 });
    }
    const payload = await request.json() as WorkbookRequest;
    const result = evaluateWorkbook(payload);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to evaluate workbook" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "Use POST /api/evaluate" }, { status: 405 });
}
