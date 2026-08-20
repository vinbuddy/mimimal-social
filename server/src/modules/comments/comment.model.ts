import { prop, getModelForClass, modelOptions, Ref, Severity } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { User } from "../users/user.model";
import { Post } from "../posts/post.model";

@modelOptions({ schemaOptions: { collection: "comments", timestamps: true }, options: { allowMixed: Severity.ALLOW } })
export class Comment {
    @prop({ auto: true })
    public _id?: mongoose.Types.ObjectId;

    @prop({ required: true, enum: ["Post", "Video"] })
    public targetType: "Post" | "Video";

    @prop({ refPath: "targetType", required: true })
    public target: Ref<Post>;
    // public target: Ref<Post | Video>;

    @prop({ default: null })
    public content: string | null;

    @prop({ ref: () => User, required: true })
    public commentBy: Ref<User>;

    @prop({ ref: () => Comment, default: null })
    public rootComment: Ref<Comment>;

    @prop({ ref: () => User, default: null })
    public replyTo: Ref<User>;

    @prop({ ref: () => User, default: [] })
    public likes: Ref<User>[];

    @prop({ ref: () => User, default: [] })
    public mentions: Ref<User>[];

    @prop({ default: [] })
    public tags?: string[];

    @prop({ default: false })
    public isEdited?: boolean;
}

const CommentModel = getModelForClass(Comment);
export default CommentModel;
