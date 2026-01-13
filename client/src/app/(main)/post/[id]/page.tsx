"use client";
import { Spinner, User } from "@heroui/react";
import { Fragment } from "react";
import useSWR from "swr";
import InfiniteScroll from "react-infinite-scroll-component";

import { BackButton, ErrorMessage } from "@/components";
import { CommentForm, CommentItem } from "@/components/comment";
import { PostDetail } from "@/components/post";

import { usePagination } from "@/hooks";
import { useAuthStore } from "@/hooks/store";
import { IComment } from "@/types/comment";
import { IPost } from "@/types/post";

export default function PostPage({ params }: { params: { id: string } }) {
    const { data, error } = useSWR(`/post/${params.id}`);
    const post = data?.data as IPost;
    const { currentUser, isAuthenticated } = useAuthStore();

    const {
        data: comments,
        isLoading,
        error: commentError,
        isReachedEnd,
        size,
        setSize: setPage,
        mutate,
    } = usePagination<IComment>(`/comment?targetType=Post&target=${params.id}`);

    if (isLoading) {
        return (
            <div className="h-screen w-full flex justify-center items-center">
                <Spinner />
            </div>
        );
    }

    if (error && !isLoading && !post) {
        return <ErrorMessage className="flex justify-center" error={error} />;
    }

    return (
        <div className="flex justify-center w-full">
            <div className="w-[calc(100vw_-_80px)] md:w-[630px]">
                <header className="sticky h-[80px] top-0 z-10 p-4 flex justify-between items-center bg-background">
                    <BackButton />

                    <User
                        className="bg-content2 rounded-full py-1.5 ps-2 pe-3"
                        name={post?.postBy?.username}
                        avatarProps={{
                            size: "sm",
                            src: post?.postBy?.photo,
                        }}
                    />
                </header>

                <main className="px-4 pb-4 mt-4">
                    <PostDetail post={post} />

                    {isAuthenticated && (
                        <div
                            className={`mt-4 sticky top-[79px] z-[1] pt-3 pb-6 bg-background border-divider ${
                                comments.length > 0 && "border-b"
                            }`}
                        >
                            <CommentForm target={post} targetType="Post" />
                        </div>
                    )}

                    <div className="flex flex-col mt-4">
                        {commentError && !isLoading && (
                            <p className="text-center text-danger">{commentError?.message}</p>
                        )}
                        {comments.length === 0 && !isLoading && !commentError && (
                            <p className="text-center">No comments yet.</p>
                        )}
                        {!commentError && comments.length > 0 && (
                            <InfiniteScroll
                                next={() => setPage(size + 1)}
                                hasMore={!isReachedEnd}
                                loader={
                                    <div className="flex justify-center items-center overflow-hidden h-[70px]">
                                        <Spinner size="md" />
                                    </div>
                                }
                                dataLength={comments?.length ?? 0}
                            >
                                {comments.map((comment) => (
                                    <Fragment key={comment?._id}>
                                        <CommentItem comment={comment} />
                                    </Fragment>
                                ))}
                            </InfiniteScroll>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
