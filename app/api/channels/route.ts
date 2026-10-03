import { NextRequest, NextResponse } from "next/server";
import { getChannels, setChannels } from "@/lib/store";

export async function GET() {
  const channels = await getChannels();
  return NextResponse.json({ channels });
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
