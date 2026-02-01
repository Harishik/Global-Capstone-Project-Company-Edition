import { FileUp, MessageSquare, LayoutDashboard } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import intellectaLogo from "@/assets/intellecta-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Document Ingestion",
    url: "/ingest",
    icon: FileUp,
  },
  {
    title: "Query & Response",
    url: "/query",
    icon: MessageSquare,
  },
];

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar-background">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <img 
            src={intellectaLogo}
            alt="Intellecta Logo"
            className="h-12 w-12 rounded-lg object-contain"
          />
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">
              Intellecta
            </h1>
            <p className="text-sm text-muted-foreground">AI Assistant</p>
          </div>
        </div>
      </SidebarHeader>

      <Separator className="bg-sidebar-border" />

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Preferences
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <ThemeToggle />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border p-4">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="font-medium">Capstone Project</p>
          <p>Offline System • v1.0</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
