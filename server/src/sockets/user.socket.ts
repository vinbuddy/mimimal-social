import { Server, Socket } from "socket.io";
import { addOnlineUser, addSocketClient, onlineUsers, socketClients } from "../shared/services/socket.service";
import ConversationModel from "../modules/messages/conversation.model";

export default function userSocketHandler(socket: Socket) {
    socket.on("online", async (data) => {
        const userId = data?.userId as string;
        if (!userId) return;

        addSocketClient(socket.id, userId);

        try {
            // Tìm các conversations mà user đã tham gia
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

                addOnlineUser(userId, {
                    userId: userId,
                    socketId: socket.id,
                    roomIds: conversations.map((conversation) => conversation._id.toString()),
                    currentRoomId: null,
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
