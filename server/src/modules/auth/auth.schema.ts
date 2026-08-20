import { z } from "zod";

export const registerSchema = z.object({
    username: z.string({ required_error: "Username is required" }),
    email: z.string({ required_error: "Email is required" }).email({ message: "Invalid email" }),
    password: z
        .string({ required_error: "Password is required" })
        .min(6, "Password is too short - should be min 6 chars")
        .max(15),
});

export const loginSchema = z.object({
    email: z.string({ required_error: "Email is required" }).email(),
    password: z.string({ required_error: "Password is required" }),
});

export const otpSchema = z.object({
    email: z.string({ required_error: "Email is required" }).email().optional(),
    otp: z.string({ required_error: "OTP is required" }),
});
export const otpResetPasswordSchema = z.object({
    email: z.string({ required_error: "Email is required" }).email(),
    // otp: z.string({ required_error: "OTP is required" }),
    password: z
        .string({ required_error: "Password is required" })
        .min(6, "Password is too short - should be min 6 chars")
        .max(15),
});

export type CreateUserInput = z.infer<typeof registerSchema>;
export type LoginUserInput = z.infer<typeof loginSchema>;
export type OTPInput = z.infer<typeof otpSchema>;
export type OTPResetPasswordInput = z.infer<typeof otpResetPasswordSchema>;
