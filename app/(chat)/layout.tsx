import { cookies } from "next/headers";
import Script from "next/script";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "../(auth)/auth";
import { CommandPalette } from "@/components/command-palette";
import { TutorialGuide } from "@/components/tutorial-guide";

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  
  // --- DEĞİŞİKLİK BURADA ---
  // Çerezden durumu oku. 
  // Eğer çerez varsa (daha önce siteye girmişse) kullanıcının tercihini kullan.
  // Eğer çerez YOKSA (ilk giriş), varsayılan olarak 'false' (KAPALI) olsun.
  const sidebarCookie = cookieStore.get("sidebar_state");
  const defaultOpen = sidebarCookie ? sidebarCookie.value === "true" : false;

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        {/* defaultOpen değerini yukarıda hesapladığımız değişkene bağladık */}
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar user={session?.user} />
          <SidebarInset>
            {children}
            <CommandPalette />
            <TutorialGuide />
          </SidebarInset>
        </SidebarProvider>
      </DataStreamProvider>
    </>
  );
}