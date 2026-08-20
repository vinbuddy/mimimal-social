import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({
    schemaOptions: { collection: "themes", timestamps: true },
    options: { allowMixed: Severity.ALLOW },
})
export class Theme {
    @prop({ auto: true })
    public _id?: mongoose.Types.ObjectId;

    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public color: string;

    @prop({ default: null })
    public description: string;
}

const ThemeModel = getModelForClass(Theme);
export default ThemeModel;
