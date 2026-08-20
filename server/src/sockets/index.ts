import { Server } from "socket.io";
import userSocketHandler from "./user.socket";

const socketHandlers = (io: Server) => {
    io.on("connection", (socket) => {
        console.log("Client connected ⚡: ", socket.id);

        // Handlers
        userSocketHandler(socket);

        socket.on("disconnect", () => {
            console.log("user disconnected ❌: ", socket.id);
        });
    });
};

export default socketHandlers;
