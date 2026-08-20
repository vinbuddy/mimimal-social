import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import mongoose from "mongoose";

export class StickerItem {
    @prop({ auto: true })
    public publicId?: mongoose.Types.ObjectId;

    @prop({ default: [] })
    public tags: string[];

    @prop({ required: true })
    public url: string;
}

@modelOptions({
    schemaOptions: { collection: "stickers", timestamps: true },
    options: { allowMixed: Severity.ALLOW },
})
export class Sticker {
    @prop({ auto: true })
    public _id?: mongoose.Types.ObjectId;

    @prop({ required: true })
    public name: string;

    @prop({ default: [] })
    public stickers: Sticker[];

    @prop({ required: true })
    public thumbnail: string;
}

const StickerModel = getModelForClass(Sticker);
export default StickerModel;
