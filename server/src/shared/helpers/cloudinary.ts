import cloudinary from "../configs/cloudinary";
import { MediaFile } from "../../modules/posts/post.model";

type ResourceType = "image" | "video" | "raw" | "auto" | undefined;

export const uploadToCloudinary = async (file: Express.Multer.File, folder: string): Promise<MediaFile> => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload_stream({ resource_type: "auto", folder: folder }, (error, result) => {
                if (error) return reject(error);

                if (result) {
                    resolve({
                        publicId: result.public_id,
                        url: result.secure_url,
                        width: result.width,
                        height: result.height,
                        type: result.resource_type as "image" | "video",
                    });
                }
            })
            .end(file.buffer);
    });
};
