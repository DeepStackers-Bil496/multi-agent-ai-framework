"use client";

import { ChevronUp, Settings, Globe, HelpCircle, BookOpen, LogOut, LogIn } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import useSWR from "swr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { guestRegex } from "@/lib/constants";
import { fetcher } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { toast } from "./toast";

interface ProfileData {
  profile: {
    fullName: string | null;
    nickname: string | null;
  } | null;
}

export function SidebarUserNav({ user }: { user: User }) {
  const router = useRouter();
  const { data: sessionData, status } = useSession();
  const { data: profileData } = useSWR<ProfileData>(
    "/api/settings/profile",
    fetcher
  );

  const isGuest = guestRegex.test(sessionData?.user?.email ?? "");

  // Display name priority: fullName > nickname > "Guest" > email
  const displayName = isGuest
    ? "Guest"
    : profileData?.profile?.fullName ||
    profileData?.profile?.nickname ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {status === "loading" ? (
              <SidebarMenuButton className="h-10 justify-between bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div className="flex flex-row gap-2">
                  <div className="size-6 animate-pulse rounded-full bg-zinc-500/30" />
                  <span className="animate-pulse rounded-md bg-zinc-500/30 text-transparent">
                    Loading auth status
                  </span>
                </div>
                <div className="animate-spin text-zinc-500">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                className="h-10 bg-background hover:bg-muted data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                data-testid="user-nav-button"
              >
                <Image
                  alt={user.email ?? "User Avatar"}
                  className="rounded-full"
                  height={24}
                  src={`https://avatar.vercel.sh/${user.email}`}
                  width={24}
                />
                <span className="truncate font-medium" data-testid="user-email">
                  {displayName}
                </span>
                <ChevronUp className="ml-auto h-4 w-4" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64"
            data-testid="user-nav-menu"
            side="top"
            align="start"
            sideOffset={8}
            alignOffset={-8}
          >
            {/* Email Label */}
            <DropdownMenuLabel className="font-normal" inset>
              <p className="text-sm text-muted-foreground truncate">
                {isGuest ? "Guest Account" : user?.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* General Section */}
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer"
                data-testid="user-nav-item-settings"
                onSelect={() => router.push("/settings")}
              >
                <Settings className="h-4 w-4" />
                Settings
                <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <Globe className="h-4 w-4" />
                  Language
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem className="cursor-pointer" disabled>
                    English (Default)
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-muted-foreground" disabled>
                    More languages coming soon
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => window.open("https://github.com/DeepStackers-Bil496/multi-agent-ai-framework", "_blank")}
              >
                <HelpCircle className="h-4 w-4" />
                Get help
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Subscription/Learn More Section */}
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <BookOpen className="h-4 w-4" />
                  Learn more
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => window.open("https://github.com/DeepStackers-Bil496/multi-agent-ai-framework#readme", "_blank")}
                  >
                    Documentation
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => router.push("/agents_dashboard")}
                  >
                    Agents Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => router.push("/settings?tab=usage")}
                  >
                    Usage Dashboard
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Auth Section */}
            <DropdownMenuItem
              className="cursor-pointer"
              data-testid="user-nav-item-auth"
              onSelect={() => {
                if (status === "loading") {
                  toast({
                    type: "error",
                    description:
                      "Checking authentication status, please try again!",
                  });
                  return;
                }

                if (isGuest) {
                  router.push("/login");
                } else {
                  signOut({
                    redirectTo: "/",
                  });
                }
              }}
            >
              {isGuest ? (
                <>
                  <LogIn className="h-4 w-4" />
                  Login to your account
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
