import passport from "passport";
import { Strategy } from "passport-google-oauth20";
import UserModel, { User } from "../users/user.model";

import env from "dotenv";
env.config();

export function initializeLoginWithGoogleService() {
    passport.use(
        new Strategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID as string,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
                callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const userFound = await UserModel.findOne({
                        email: profile.emails?.[0].value,
                    }).lean();

                    // Login
                    if (userFound && userFound.googleId === profile.id) {
                        console.log("USER LOGIN WITH GOOGLE");
                        return done(null, userFound);
                    }

                    // Login and update googleId
                    if (userFound && !userFound.googleId) {
                        const user = await UserModel.findByIdAndUpdate(
                            userFound._id,
                            {
                                googleId: profile.id,
                            },
                            { new: true }
                        );

                        console.log("USER LOGIN AND UPDATE GOOGLE ID");
                        if (user) return done(null, user);
                    }

                    // Login with existed googleId
                    if (userFound) {
                        return done(null, userFound);
                    }

                    // Register new user
                    if (!userFound) {
                        const user = await UserModel.create({
                            googleId: profile.id,
                            username: profile.displayName,
                            email: profile.emails?.[0].value,
                            photo: profile.photos?.[0].value,
                        });

                        console.log("USER REGISTER WITH GOOGLE");

                        return done(null, user);
                    }
                } catch (error) {
                    return done(error);
                }
            }
        )
    );

    passport.serializeUser((_user, done) => {
        const user = _user as User;
        done(null, user._id);
    });

    // Định nghĩa deserializeUser
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await UserModel.findById(id).lean();
            done(null, user);
        } catch (error) {
            done(error);
        }
    });
}
