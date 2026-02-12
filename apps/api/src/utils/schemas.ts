import { z } from "zod";

// Auth
export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    locale: z.string().optional(),
    captchaToken: z.string().optional(),
    fingerprint: z.string().optional(),
    deviceId: z.string().optional(),
    deviceName: z.string().optional(),
  })
  .passthrough();

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(1).max(100),
  locale: z.string().optional(),
  captchaToken: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
  expires: z.string().optional(),
  sig: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  locale: z.string().optional(),
  captchaToken: z.string().optional(),
});

// Messages
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  type: z.enum(["text", "image", "file"]).optional().default("text"),
});

export const widgetSendMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(10000),
});

// Org/Settings
export const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  widgetEnabled: z.boolean().optional(),
  language: z.string().max(5).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

// Widget
export const widgetInitSchema = z.object({
  orgKey: z.string().min(1),
  visitorId: z.string().optional(),
});
