import { Severity, getModelForClass, modelOptions, pre, prop } from "@typegoose/typegoose";
import bcrypt from "bcrypt";

@pre<OTP>("save", async function () {
    if (!this.isModified("otp")) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(this.otp, salt);

    this.otp = hashedPassword;

    return;
})
@modelOptions({ schemaOptions: { collection: "otps", timestamps: true }, options: { allowMixed: Severity.ALLOW } })
class OTP {
    @prop({ required: false, default: "" })
    public username: string;

    @prop({ required: true, unique: true })
    public email: string;

    @prop({ required: false, default: "" })
    public password: string;

    @prop({ required: true })
    otp: string;

    @prop({ required: false, default: "register" })
    type: "register" | "forgot" | "change";

    @prop({ default: Date.now, expires: process.env.OTP_EXPIRATION ?? "5m" })
    createdAt: Date;
}

export const OTPModel = getModelForClass(OTP);
