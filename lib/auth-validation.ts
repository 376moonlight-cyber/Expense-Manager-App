import { z } from "zod";

export const signupSchema = z.object({
  name: z
    .string({ error: "Name must be a string" })
    .trim()
    .min(1, { message: "Name is required" })
    .max(80, { message: "Name must be at most 80 characters" }),
  email: z
    .string({ error: "Email must be a string" })
    .trim()
    .email({ message: "Enter a valid email" })
    .max(255, { message: "Email is too long" }),
  password: z
    .string({ error: "Password must be a string" })
    .min(8, { message: "Password must be at least 8 characters" })
    .max(72, { message: "Password must be at most 72 characters" }),
});

export const loginSchema = z.object({
  email: z
    .string({ error: "Email must be a string" })
    .trim()
    .email({ message: "Enter a valid email" }),
  password: z
    .string({ error: "Password must be a string" })
    .min(1, { message: "Password is required" }),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
