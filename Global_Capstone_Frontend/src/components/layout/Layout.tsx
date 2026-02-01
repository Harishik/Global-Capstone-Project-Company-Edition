import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-2" />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot-success" />
              <span className="text-xs font-medium text-muted-foreground">
                System Online
              </span>
            </div>
          </header>
          <div className="flex-1 p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
