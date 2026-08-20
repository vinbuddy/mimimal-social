// We no longer need in-memory socketClients and onlineUsers 
// because we are using Socket.IO Redis Adapter and rooms.
// Each user joins a room named by their userId.

export function addSocketClient(socketId: string, userId: string) {
    // Deprecated. Use socket.join(userId) instead.
}

export function removeSocketClient(socketId: string) {
    // Deprecated.
}

export function getSocketClientsByUserId(userId: string): string[] {
    // Deprecated. Use io.to(userId).emit(...) instead.
    return [userId]; // Return userId itself so io.to(socketId) becomes io.to(userId)
}

// ONLINE USER
export interface OnlineUser {
    userId: string;
    socketId: string;
    roomIds: string[];
    currentRoomId: string | null;
}

export function addOnlineUser(userId: string, userInfo: OnlineUser) {
    // Deprecated.
}
