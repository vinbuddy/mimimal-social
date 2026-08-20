import mongoose from "mongoose";
import { getModelForClass, prop, index, Ref } from "@typegoose/typegoose";
import { User } from "./user.model";

@index({ follower: 1, following: 1 }, { unique: true }) // Prevent duplicate follows
export class Follow {
    @prop({ ref: () => User, required: true })
    public follower!: Ref<User>;

    @prop({ ref: () => User, required: true })
    public following!: Ref<User>;
}

export const FollowModel = getModelForClass(Follow, {
    schemaOptions: { timestamps: true },
});
