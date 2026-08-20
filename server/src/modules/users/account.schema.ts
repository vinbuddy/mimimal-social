import { z } from "zod";

export const changePasswordSchema = z.object({
    password: z.string({ required_error: "Old password is required" }),
    newPassword: z
        .string({ required_error: "New password is required" })
        .min(6, "Password is too short - should be min 6 chars")
        .max(15),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
