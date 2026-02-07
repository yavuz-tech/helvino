import "fastify";
import "@fastify/session";
import type { Server } from "socket.io";
import type { Organization } from "../types";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }

  interface FastifyRequest {
    org?: Organization;
    rawBody?: string;
  }
}

declare module "fastify" {
  interface FastifySessionObject {
    adminUserId?: string;
    adminRole?: string;
    adminEmail?: string;
    adminMfaPending?: boolean;
    adminStepUpUntil?: number;
    orgUserId?: string;
    orgId?: string;
    orgRole?: string;
  }
}

declare module "@fastify/session" {
  interface FastifySessionObject {
    adminUserId?: string;
    adminRole?: string;
    adminEmail?: string;
    adminMfaPending?: boolean;
    adminStepUpUntil?: number;
    orgUserId?: string;
    orgId?: string;
    orgRole?: string;
  }
}
