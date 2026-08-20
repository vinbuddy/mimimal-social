import mongoose from "mongoose";
import { getModelForClass, prop, index, Ref } from "@typegoose/typegoose";
import { User } from "./user.model";

@index({ blocker: 1, blocked: 1 }, { unique: true }) // Prevent duplicate blocks
export class Block {
    @prop({ ref: () => User, required: true })
    public blocker!: Ref<User>;

    @prop({ ref: () => User, required: true })
    public blocked!: Ref<User>;
}

export const BlockModel = getModelForClass(Block, {
    schemaOptions: { timestamps: true },
});
