import fs from "fs";
import path from "path";
import type { ChannelConfig } from "./types";

type LocalData = {
  channels: ChannelConfig[];
  processedVideos: string[];
};

const LOCAL_PATH = path.join(process.cwd(), ".store.json");

function isRedisAvailable() {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function readLocal(): LocalData {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf-8"));
  } catch {
    return { channels: [], processedVideos: [] };
  }
}

function writeLocal(data: LocalData) {
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(data, null, 2));
}

async function getRedis() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function getChannels(): Promise<ChannelConfig[]> {
  if (isRedisAvailable()) {
    const redis = await getRedis();
    return (await redis.get<ChannelConfig[]>("channels")) ?? [];
  }
  return readLocal().channels;
}

export async function setChannels(channels: ChannelConfig[]): Promise<void> {
  if (isRedisAvailable()) {
    const redis = await getRedis();
    await redis.set("channels", channels);
  } else {
    const data = readLocal();
    data.channels = channels;
    writeLocal(data);
  }
}

export async function isVideoProcessed(videoId: string): Promise<boolean> {
  if (isRedisAvailable()) {
    const redis = await getRedis();
    return (await redis.exists(`processed:${videoId}`)) === 1;
  }
  return readLocal().processedVideos.includes(videoId);
}

export async function markVideoProcessed(videoId: string): Promise<void> {
  if (isRedisAvailable()) {
    const redis = await getRedis();
    // 30-day expiry so processed list doesn't grow forever
    await redis.set(`processed:${videoId}`, 1, { ex: 60 * 60 * 24 * 30 });
  } else {
    const data = readLocal();
    if (!data.processedVideos.includes(videoId)) {
      data.processedVideos.push(videoId);
      writeLocal(data);
    }
  }
}
