import { prisma } from "@/lib/prisma";

async function nextSequence(counterId: string): Promise<number> {
  const counter = await prisma.counter.upsert({
    where: { id: counterId },
    update: { value: { increment: 1 } },
    create: { id: counterId, value: 1 },
  });
  return counter.value;
}

function pad(n: number, width = 4): string {
  return String(n).padStart(width, "0");
}

export async function nextTicketCode(): Promise<string> {
  return `TCK-${pad(await nextSequence("ticket"))}`;
}

export async function nextAssetCode(): Promise<string> {
  return `EQ-${pad(await nextSequence("asset"))}`;
}

export async function nextPurchaseCode(): Promise<string> {
  return `OC-${pad(await nextSequence("purchase"))}`;
}
