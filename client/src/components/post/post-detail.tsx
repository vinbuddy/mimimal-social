"use client";

import { IPost } from "@/types/post";
import { Avatar, Tooltip } from "@heroui/react";
import { useState } from "react";
import Link from "next/link";
import { EllipsisIcon, WandSparklesIcon } from "lucide-react";
import parse, { domToReact, HTMLReactParserOptions } from "html-react-parser";

import UserName from "../user/user-name";
import UserProfileCard from "../user/user-profile-card";
import TimeAgo from "../time-ago";
import PostMenuDropdown from "./post-menu-dropdown";
import PostModalButton from "./post-modal-button";
import MediaFileSlider from "../media/media-file-slider";
import PostActions from "./post-actions";
import FullScreenMediaSlider from "../media/fullscreen-media-slider";
import PostActivitiesModalButton from "./post-activities-modal-button";

import { useVisibility } from "@/hooks";
import { useAuthStore } from "@/hooks/store";
import { useTranslation } from "react-i18next";
import { TranslationNameSpace } from "@/types/translation";

interface IProps {
    post: IPost;
}

export default function PostDetail({ post }: IProps) {
    const { isVisible: open, show: showFullscreenSlider, hide: hideFullscreenSlider } = useVisibility();
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [openEditModal, setOpenEditModal] = useState<boolean>(false);
    const { t: tPost } = useTranslation<TranslationNameSpace>("post");
    const { isAuthenticated } = useAuthStore();

    const handleMediaFileClick = (index: number) => {
        setActiveIndex(index);
        showFullscreenSlider();
    };

    const handleToggleEditModal = () => {
        setOpenEditModal(!openEditModal);
    };

    const convertLinksToAnchors = (content: string) => {
        // Regex URL
        const urlRegex = /(https?:\/\/(?:www\.)?[^\s/$.?#].[^\s]*)/gi;

        // Replace URL -> `<a>`
        return content.replace(
            urlRegex,
            (url) =>
                `<a class="text-link hover:underline font-medium" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
        );
    };

    // Convert <a> to <Link> tag
    const parserOptions: HTMLReactParserOptions = {
        replace({ attribs, children }: any) {
            if (!attribs) {
                return;
            }

            if (attribs.class === "text-link") {
                return (
                    <Link href={attribs.href} className="text-link">
                        {domToReact(children, parserOptions)}
                    </Link>
                );
            }
        },
    };

    return (
        <div>
            <FullScreenMediaSlider
                onHide={hideFullscreenSlider}
                isOpen={open}
                activeSlideIndex={activeIndex}
                mediaFiles={post?.mediaFiles}
            />
            <section className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Avatar
                        isBordered
                        src={post?.postBy?.photo}
                        alt={post?.postBy?.username}
                        size="md"
                        className="cursor-pointer"
                    />
                    <Tooltip delay={500} placement="bottom-start" content={<UserProfileCard user={post?.postBy} />}>
                        <h4>
                            <UserName className="leading-none" user={post?.postBy} />
                        </h4>
                    </Tooltip>
                </div>

                <div className="flex items-center gap-3">
                    {post?.isEdited && (
                        <Tooltip content={tPost("POST_IS_EDITED")} placement="bottom" showArrow>
                            <WandSparklesIcon className="cursor-pointer" size={16} />
                        </Tooltip>
                    )}

                    {/* Time */}
                    <div className="text-grey cursor-pointer">
                        <TimeAgo className="text-sm" date={post?.createdAt} />
                    </div>

                    {/* Menu - Only show for authenticated users */}
                    {isAuthenticated && (
                        <>
                            <div className="flex flex-col justify-center">
                                <PostMenuDropdown onOpenEditModal={handleToggleEditModal} post={post}>
                                    <button className="outline-none rounded-full z-[1]">
                                        <EllipsisIcon size={16} />
                                    </button>
                                </PostMenuDropdown>
                            </div>
                            <PostModalButton post={post} open={openEditModal} setOpen={setOpenEditModal} actionType="edit">
                                <div></div>
                            </PostModalButton>
                        </>
                    )}
                </div>
            </section>
            <section className="mt-4">
                <div className="block mb-2">{parse(convertLinksToAnchors(post?.caption) ?? "", parserOptions)}</div>
                <MediaFileSlider
                    onMediaFileClick={handleMediaFileClick}
                    mediaFiles={post?.mediaFiles ?? []}
                    videoPreview={true}
                    scrollHorizontally={false}
                />
                {/* Like, Share, Save,... */}
                <div className="mt-2 flex items-center justify-between">
                    <PostActions post={post} />

                    {isAuthenticated && (
                        <PostActivitiesModalButton
                            post={post}
                            size="sm"
                            variant="light"
                            radius="full"
                            className="text-default-500 text-sm px-3 cursor-pointer"
                        >
                            {tPost("POST_DETAIL.SEE_ACTIVITY")}
                        </PostActivitiesModalButton>
                    )}
                </div>
            </section>
        </div>
    );
}
