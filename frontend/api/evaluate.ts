import type { VercelRequest, VercelResponse } from "@vercel/node";
import { evaluateWorkbook, type WorkbookRequest } from "../src/lib/evaluator";

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
    const result = evaluateWorkbook(payload);
    return response.status(200).json(result);
  } catch (error) {
    return response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to evaluate workbook"
    });
  }
}
