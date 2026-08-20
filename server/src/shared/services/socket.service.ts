export const socketClients: Record<string, string> = {
    // [socketId]: userId
};

export function addSocketClient(socketId: string, userId: string) {
    socketClients[socketId] = userId;
}

export function removeSocketClient(socketId: string) {
    if (socketClients[socketId]) {
        delete socketClients[socketId];
    }
}

export function getSocketClientsByUserId(userId: string): string[] {
    return Object.keys(socketClients).filter((socketId) => socketClients[socketId] === userId);
}

//  ONLINE USER
export interface OnlineUser {
    userId: string;
    socketId: string;
    roomIds: string[];
    currentRoomId: string | null;
}
export const onlineUsers: Record<string, OnlineUser> = {
    // [userId]: OnlineUser
};

export function addOnlineUser(userId: string, userInfo: OnlineUser) {
    if (!onlineUsers[userId]) {
        onlineUsers[userId] = userInfo;
    }
}
