import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ status: "ok", service: "CellScript Vercel API" });
}
