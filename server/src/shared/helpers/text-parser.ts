import UserModel from "../../modules/users/user.model";

export const extractMentionsAndTags = (html: string) => {
    const mentionRegex = /@(\w+)/g;
    const tagRegex = /#(\w+)/g;

    let mentions = [];
    let tags = [];

    let match;
    while ((match = mentionRegex.exec(html)) !== null) {
        mentions.push(match[1]); // Push captured username (without @) into mentions array
    }

    while ((match = tagRegex.exec(html)) !== null) {
        tags.push(match[1]); // Push captured tag (without #) into tags array
    }

    return { mentions, tags };
};

export const replaceHrefs = async (caption: string) => {
    try {
        // Extract href - username
        const aTags = caption.match(/<a\s+href="\/profile\/([^"]+)"/g);
        const usernames = aTags?.map((tag) => tag.match(/\/profile\/([^"]+)/)?.[1]);

        const userMap: any = {};

        if (usernames) {
            // Find userIds by usernames in database
            const users = await UserModel.find({ username: { $in: usernames } });
            users.forEach((user) => {
                userMap[user.username] = user._id;
            });
        }

        const updatedCaption = caption.replace(/<a\s+href="\/profile\/([^"]+)"/g, (match, username) => {
            const userId = userMap[username];
            return userId ? `<a href="/profile/${userId}"` : match;
        });

        return updatedCaption;
    } catch (error) {
        console.error(error);
    }
};
