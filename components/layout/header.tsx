"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Users, ClipboardList, LayoutDashboard, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";

  const navItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/afe",
      label: "AFEs",
      icon: FileText,
    },
    ...(isAdmin
      ? [
          {
            href: "/admin/users",
            label: "Users",
            icon: Users,
          },
          {
            href: "/admin/audit",
            label: "Audit Log",
            icon: ClipboardList,
          },
        ]
      : []),
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold mr-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline-block">AFE Approval</span>
        </Link>

        {/* Navigation */}
        {user && (
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive(item.href) ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "gap-2",
                      isActive(item.href) && "bg-secondary font-medium"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden md:inline-block">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {status === "loading" ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-3">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="hidden sm:inline-block font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                    {user.role}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="cursor-pointer text-red-600 dark:text-red-400"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
