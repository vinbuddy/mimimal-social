import { Request } from "express";
import { User } from "../../modules/users/user.model";

export interface UserToken {
    _id: string;
    isAdmin: boolean;
    iat: number;
    exp: number;
}

export interface RequestWithUser extends Request {
    user: UserToken;
}

export interface RequestWithFiles extends Request {
    files: Express.Multer.File[];
}
