import { z } from "zod";

const displayNameSchema = z
  .string({ error: "Name must be a string" })
  .trim()
  .min(1, { message: "Name is required" })
  .max(80, { message: "Name must be at most 80 characters" });

const passwordSchema = z
  .string({ error: "Password must be a string" })
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be at most 72 characters" });

export const signupSchema = z.object({
  name: displayNameSchema,
  email: z
    .string({ error: "Email must be a string" })
    .trim()
    .email({ message: "Enter a valid email" })
    .max(255, { message: "Email is too long" }),
  password: passwordSchema,
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

export const profileNameSchema = z.object({
  name: displayNameSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Current password must be a string" })
      .min(1, { message: "Current password is required" }),
    newPassword: passwordSchema,
    confirmPassword: z
      .string({ error: "Confirm password must be a string" })
      .min(1, { message: "Confirm password is required" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileNameInput = z.infer<typeof profileNameSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
