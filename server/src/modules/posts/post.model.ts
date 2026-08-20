import { prop, getModelForClass, modelOptions, Severity, Ref, pre, index } from "@typegoose/typegoose";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import cloudinary from "cloudinary";

import { User } from "../users/user.model";

export class MediaFile {
    @prop({ required: true })
    public publicId: string;

    @prop({ required: true })
    public url: string;

    @prop({ required: true })
    public width: number;

    @prop({ required: true })
    public height: number;

    @prop({ required: true })
    public type: "image" | "video";
}

@modelOptions({ schemaOptions: { collection: "posts", timestamps: true }, options: { allowMixed: Severity.ALLOW } })
@index({ postBy: 1, createdAt: -1 })
@index({ caption: "text", tags: "text" })
export class Post {
    @prop({ auto: true })
    public _id?: mongoose.Types.ObjectId;

    @prop({ default: null })
    public caption: string;

    @prop({ default: [] })
    public mediaFiles: MediaFile[];

    @prop({ default: false })
    public isEdited?: boolean;

    @prop({ ref: () => User })
    public postBy: Ref<User>;

    @prop({ ref: () => User })
    public mentions: Ref<User>[];

    @prop()
    public tags: string[];

    @prop({ ref: () => Post, default: null })
    public originalPost: Ref<Post>;
}

const PostModel = getModelForClass(Post);
export default PostModel;
