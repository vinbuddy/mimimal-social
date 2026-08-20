import jwt from "jsonwebtoken";

import dotenv from "dotenv";
import { User } from "../../modules/users/user.model";

dotenv.config();

const generateToken = (user: User, type: "access" | "refresh" = "access"): string => {
    const key = type == "access" ? (process.env.JWT_ACCESS_KEY as string) : (process.env.JWT_REFRESH_KEY as string);

    const accessToken = jwt.sign(
        {
            _id: user._id,
            isAdmin: user.isAdmin,
        },
        key,
        {
            expiresIn: type == "access" ? process.env.JWT_ACCESS_EXPIRATION : process.env.JWT_REFRESH_EXPIRATION,
        }
    );

    return accessToken;
};

export { generateToken };
