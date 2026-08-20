import { NextFunction, Request, Response } from "express";
import StickerModel from "./sticker.model";

export async function getStickersHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const stickers = await StickerModel.find();

        return res.status(200).json({ message: "Success", data: stickers });
    } catch (error) {
        next(error);
    }
}
