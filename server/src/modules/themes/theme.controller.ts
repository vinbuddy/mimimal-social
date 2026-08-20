import { NextFunction, Request, Response } from "express";
import ThemeModel from "./theme.model";

export async function getThemesHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const themes = await ThemeModel.find();

        return res.status(200).json({ message: "Success", data: themes });
    } catch (error) {
        next(error);
    }
}
