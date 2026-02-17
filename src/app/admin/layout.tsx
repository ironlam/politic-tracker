import { isAuthenticated as checkAuth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import { AdminCmdKTrigger } from "@/components/admin/AdminCmdKTrigger";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = await checkAuth();

  // Login page — render without admin chrome
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <a href="#admin-main" className="skip-link">
        Aller au contenu principal
      </a>

      <AdminSidebar />

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center justify-between h-14 px-6">
            {/* Left spacer for mobile menu button */}
            <div className="lg:hidden w-10" />
            <AdminBreadcrumb />
            <div className="flex items-center gap-2">
              <AdminCmdKTrigger />
            </div>
          </div>
        </header>

        <main id="admin-main" role="main" className="flex-1 p-6">
          {children}
        </main>
      </div>

      <AdminCommandPalette />
    </div>
  );
}
