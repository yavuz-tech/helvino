import { FastifyReply } from "fastify";
import { z } from "zod";

export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
  reply: FastifyReply
): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    reply.status(400).send({
      error: "Validation failed",
      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return null;
  }
  return result.data;
}
