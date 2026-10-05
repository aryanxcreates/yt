import { NextRequest, NextResponse } from "next/server";
import { getChannels, setChannels, getLastRun } from "@/lib/store";

export async function GET() {
  const [channels, lastRun] = await Promise.all([getChannels(), getLastRun()]);
  return NextResponse.json({ channels, lastRun });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { channelId } = body as { channelId?: string };

  if (channelId) {
    const channels = await getChannels();
    await setChannels(channels.filter((c) => c.channelId !== channelId));
  } else {
    await setChannels([]);
  }

  return NextResponse.json({ success: true });
}
