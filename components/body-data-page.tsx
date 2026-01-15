'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const routeMap: Record<string, string> = {
  '/': 'marketing',
  '/pricing': 'pricing',
  '/dashboard': 'dashboard',
  '/dashboard/general': 'account_general',
  '/dashboard/security': 'account_security',
  '/admin/modules': 'admin_modules',
  '/admin/runs': 'admin_runs',
  '/admin/approvals': 'admin_approvals',
  '/admin/audit': 'admin_audit',
  '/sign-in': 'sign_in',
  '/sign-up': 'sign_up',
};

export default function BodyDataPage() {
  const pathname = usePathname();

  useEffect(() => {
    if (!document?.body) {
      return;
    }

    if (pathname.startsWith('/dashboard/modules/')) {
      document.body.dataset.page = 'module_detail';
      return;
    }
    if (pathname.startsWith('/admin/modules/')) {
      document.body.dataset.page = 'admin_module_editor';
      return;
    }

    document.body.dataset.page = routeMap[pathname] || 'unknown';
  }, [pathname]);

  return null;
}
