'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ClipboardList, FileText, ShieldCheck, Menu } from 'lucide-react';
import useSWR from 'swr';
import { type User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();
  const { data: user } = useSWR<User>('/api/user', fetcher);

  useEffect(() => {
    if (!user) {
      return;
    }
    const isModulesRoute = pathname.startsWith('/admin/modules');
    if (user.role === 'ADMIN') {
      return;
    }
    if (user.role === 'AGENT' && isModulesRoute) {
      return;
    }
    router.replace('/dashboard');
  }, [pathname, router, user]);

  const navItems = [
    { href: '/admin/modules', icon: FileText, label: 'Modules' },
    ...(user?.role === 'ADMIN'
      ? [
          { href: '/admin/approvals', icon: ShieldCheck, label: 'Approvals' },
          { href: '/admin/runs', icon: ClipboardList, label: 'Runs' },
          { href: '/admin/audit', icon: ClipboardList, label: 'Audit Log' },
        ]
      : []),
  ];

  const isModulesRoute = pathname.startsWith('/admin/modules');
  if (user && user.role !== 'ADMIN' && !(user.role === 'AGENT' && isModulesRoute)) {
    return (
      <section className="flex-1 p-6" data-page="admin_forbidden">
        <p className="text-sm text-muted-foreground">Admin access required.</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full">
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <div className="flex items-center">
          <span className="font-medium">Admin</span>
        </div>
        <Button
          className="-mr-3"
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden h-full">
        <aside
          className={`w-64 bg-white lg:bg-gray-50 border-r border-gray-200 lg:block ${
            isSidebarOpen ? 'block' : 'hidden'
          } lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="h-full overflow-y-auto p-4">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className={`shadow-none my-1 w-full justify-start ${
                    pathname === item.href ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                  data-action="admin_nav"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-0 lg:p-4">{children}</main>
      </div>
    </div>
  );
}
