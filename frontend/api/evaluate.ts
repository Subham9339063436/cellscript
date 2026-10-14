import type { VercelRequest, VercelResponse } from "@vercel/node";

type WorkbookRequest = {
  formulas?: Record<string, string>;
  values?: Record<string, number>;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Use POST /api/evaluate" });
  }

  const contentLength = Number(request.headers["content-length"] || "0");
  if (contentLength > 2 * 1024 * 1024) {
    return response.status(413).json({ error: "Request body is too large (maximum 2 MB)" });
  }

  try {
    const payload = (typeof request.body === "string"
      ? JSON.parse(request.body)
      : request.body) as WorkbookRequest;

    // Load the evaluator inside the handler so module/bundling failures become a
    // structured API response instead of an opaque FUNCTION_INVOCATION_FAILED.
    const evaluator = await import("../src/lib/evaluator");
    const result = evaluator.evaluateWorkbook(payload);

    return response.status(200).json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("CellScript /api/evaluate failed:", error);
    const invalidRequest = /Request body|must be an object|must be a string|must be a finite number|must start with|Unknown function|Unexpected character|Expected |Unexpected trailing input|requires at least|Referenced cell|Circular reference|Division by zero|Invalid cell reference|cannot contain both|range is too large/i.test(detail);
    return response.status(invalidRequest ? 400 : 500).json({
      error: invalidRequest ? "Unable to evaluate workbook request" : "Evaluation handler failed",
      detail
    });
  }
}
