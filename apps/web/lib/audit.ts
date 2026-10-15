import { prisma } from "@tlm/db";

export async function audit(action: string, detail?: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      detail: detail === undefined ? undefined : JSON.stringify(detail),
    },
  });
}
