"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { LayoutDashboard, MessageSquare, Search } from "lucide-react";
import { getChatHistoryPaginationKey, type ChatHistory } from "@/components/sidebar-history";
import { fetcher } from "@/lib/utils";

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();

    const { data: history } = useSWRInfinite<ChatHistory>(
        getChatHistoryPaginationKey,
        fetcher,
        {
            fallbackData: [],
        }
    );

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey) && e.altKey) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    const handleContinueChat = () => {
        if (params.id) {
            setOpen(false);
            return;
        }

        const chats = history?.flatMap((page) => page.chats) || [];
        const latestChat = chats[0];

        if (latestChat) {
            router.push(`/chat/${latestChat.id}`);
        } else {
            router.push("/");
        }
    };

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => runCommand(handleContinueChat)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <span>Continue Chat</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Dashboards">
                    <CommandItem
                        onSelect={() => runCommand(() => router.push("/user_dashboard"))}
                    >
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>User Dashboard</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
