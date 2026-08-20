import mongoose from "mongoose";
import { getModelForClass, prop, index, Ref } from "@typegoose/typegoose";
import { User } from "../users/user.model";
import { Post } from "./post.model";

@index({ post: 1, user: 1 }, { unique: true }) // A user can only like a post once
export class PostLike {
    @prop({ ref: () => Post, required: true })
    public post!: Ref<Post>;

    @prop({ ref: () => User, required: true })
    public user!: Ref<User>;
}

export const PostLikeModel = getModelForClass(PostLike, {
    schemaOptions: { timestamps: true },
});
