import { prisma } from "../prisma";

export async function isKnownDeviceFingerprint(
  orgUserId: string,
  fingerprint: string
): Promise<boolean> {
  const existing = await prisma.portalSession.findFirst({
    where: {
      orgUserId,
      deviceFingerprint: fingerprint,
    },
    select: { id: true },
  });
  return Boolean(existing);
}
