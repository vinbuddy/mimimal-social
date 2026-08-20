import { Server, Socket } from "socket.io";
// Imports removed
import ConversationModel from "../modules/messages/conversation.model";

export default function userSocketHandler(socket: Socket) {
    socket.on("online", async (data) => {
        const userId = data?.userId as string;
        if (!userId) return;

        // User joins their personal room for direct notifications
        socket.join(userId);
        console.log(`User ${userId} is online and joined personal room`);

        try {
            // Join conversation rooms
            const conversations = await ConversationModel.find({
                participants: {
                    $in: [userId],
                },
            }).lean();

            if (conversations.length > 0) {
                conversations.forEach((conversation) => {
                    socket.join(conversation._id.toString());
                    console.log(`User ${userId} joined room ${conversation._id}`);
                });
            } else {
                console.log(`User ${userId} has no conversations`);
            }
        } catch (error) {
            console.error("Error fetching conversations:", error);
        }

        socket.emit("online", { message: "User online successfully" });
    });
}
