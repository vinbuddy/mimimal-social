"use client";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { CommentIcon, HeartIcon, RepostIcon } from "@/assets/icons";
import { useAuthStore } from "@/hooks/store";
import { useGlobalMutation } from "@/hooks";
import { IPost } from "@/types/post";
import axiosInstance from "@/utils/http-request";

interface IProps {
    post: IPost;
}

export default function PostActions({ post }: IProps) {
    const { currentUser, isAuthenticated } = useAuthStore();
    const [isLiked, setIsLiked] = useState<boolean>(() => post?.likes?.includes(currentUser?._id) || false);
    const [likeCount, setLikeCount] = useState<number>(post?.likeCount ?? 0);
    const [isReposted, setIsReposted] = useState<boolean>(
        () => post?.originalPost?.reposts?.includes(currentUser?._id) || false
    );
    const [repostCount, setRepostCount] = useState<number>(
        post?.originalPost?._id ? post?.originalPost?.repostCount ?? 0 : 0
    );
    const mutate = useGlobalMutation();
    const handleUnLike = async (): Promise<void> => {
        setIsLiked(false);
        setLikeCount((prev) => prev - 1);

        if (!currentUser?._id || !post?._id) return;

        try {
            const response = await axiosInstance.post("/post/unlike", {
                postId: post._id,
                userId: currentUser?._id,
            });

            toast.success("Unliked post successfully", {
                position: "bottom-center",
            });
        } catch (error: any) {
            setIsLiked(true);
            setLikeCount((prev) => prev + 1);
            toast.error("Failed to unlike post", {
                position: "bottom-center",
            });
            console.log(error.response.data.message);
        }
    };

    const handleLike = async (): Promise<void> => {
        setIsLiked(true);
        setLikeCount((prev) => prev + 1);

        try {
            const response = await axiosInstance.post("/post/like", {
                postId: post._id,
                userId: currentUser?._id,
            });

            const notificationResponse = await axiosInstance.post("/notification", {
                target: post?._id,
                targetType: "Post",
                action: "like",
                photo: currentUser?.photo,
                message: `liked your post`,
                sender: currentUser?._id,
                receivers: [post?.postBy?._id],
                url: `/post/${post?._id}`,
            });

            toast.success("Liked post successfully", {
                position: "bottom-center",
            });
        } catch (error: any) {
            setIsLiked(false);
            setLikeCount((prev) => prev - 1);

            toast.error("Failed to like post", {
                position: "bottom-center",
            });
            toast.error(error.response.data.message, { position: "bottom-center" });
            console.log(error.response.data.message);
        }
    };

    const handleUnRepost = async (): Promise<void> => {
        setIsReposted(false);
        setRepostCount((prev) => prev - 1);

        if (!currentUser?._id || !post?._id) return;

        try {
            const response = await axiosInstance.post("/post/un-repost", {
                originalPostId: post?.originalPost?._id,
                postId: post._id,
                userId: currentUser?._id,
            });

            mutate((key) => typeof key === "string" && key.includes("/post"));

            toast.success("UnRepost successfully", {
                position: "bottom-center",
            });
        } catch (error: any) {
            setIsReposted(true);
            setRepostCount((prev) => prev + 1);
            toast.error("Failed to Un-Repost", {
                position: "bottom-center",
            });
            console.log(error.response.data.message);
        }
    };

    const handleRepost = async (): Promise<void> => {
        setIsReposted(true);
        setRepostCount((prev) => prev + 1);

        try {
            const response = await axiosInstance.post("/post/repost", {
                postId: post._id,
                userId: currentUser?._id,
            });

            const notificationResponse = await axiosInstance.post("/notification", {
                target: post?._id,
                targetType: "Post",
                action: "repost",
                photo: currentUser?.photo,
                message: `reposted your post`,
                sender: currentUser?._id,
                receivers: [post?.postBy?._id],
                url: `/post/${post?._id}`,
            });

            mutate((key) => typeof key === "string" && key.includes("/post"));

            toast.success("Repost successfully", {
                position: "bottom-center",
            });
        } catch (error: any) {
            setIsReposted(false);
            setRepostCount((prev) => prev - 1);

            toast.error("Failed to repost", {
                position: "bottom-center",
            });
            console.log(error.response.data.message);
        }
    };

    return (
        <div>
            <Button
                title="like"
                onPress={isAuthenticated ? (isLiked ? handleUnLike : handleLike) : undefined}
                size="sm"
                radius="full"
                color={isLiked ? "danger" : "default"}
                variant="light"
                isDisabled={!isAuthenticated}
                startContent={<HeartIcon isFilled={isLiked} size={18} />}
            >
                {likeCount}
            </Button>
            <Button
                title="comment"
                href={isAuthenticated ? `/post/${post?._id}` : undefined}
                as={isAuthenticated ? Link : undefined}
                size="sm"
                radius="full"
                variant="light"
                isDisabled={!isAuthenticated}
                startContent={<CommentIcon isFilled={false} size={18} />}
            >
                {post?.commentCount ?? 0}
            </Button>

            <Button
                onPress={isAuthenticated ? (isReposted ? handleUnRepost : handleRepost) : undefined}
                title="repost"
                size="sm"
                radius="full"
                variant="light"
                color={isReposted ? "success" : "default"}
                isDisabled={!isAuthenticated}
                startContent={<RepostIcon size={18} />}
            >
                {repostCount}
            </Button>
        </div>
    );
}
