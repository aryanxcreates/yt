import { NextResponse } from "next/server";
import { processChannels } from "@/lib/processor";

export async function POST() {
  try {
    const results = await processChannels();
    const commented = results.filter((r) => r.commented).length;
    const errored = results.filter((r) => r.error).length;
    return NextResponse.json({
      success: true,
      results,
      summary: { total: results.length, commented, errored },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
