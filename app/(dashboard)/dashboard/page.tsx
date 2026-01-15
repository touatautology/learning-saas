'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { type LearningModule, type Subscription } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function SubscriptionStatus() {
  const { data: subscription } = useSWR<Subscription | null>(
    '/api/subscription',
    fetcher
  );

  return (
    <Card data-section="subscription_status">
      <CardHeader>
        <CardTitle>Billing Status</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Status:{' '}
          <span className="font-medium text-foreground">
            {subscription?.status || 'inactive'}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          Plan: {subscription?.planName || 'Free'}
        </p>
        <Button asChild variant="outline" className="mt-4" data-action="open_pricing">
          <Link href="/pricing">Manage Subscription</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ModuleList() {
  const { data: modules } = useSWR<LearningModule[]>('/api/modules', fetcher);

  return (
    <Card data-section="module_list">
      <CardHeader>
        <CardTitle>Learning Modules</CardTitle>
      </CardHeader>
      <CardContent>
        {modules?.length ? (
          <div className="grid gap-4">
            {modules.map((module) => (
              <div
                key={module.id}
                className="flex items-center justify-between border rounded-lg p-4"
                data-module-id={module.id}
                data-source-module-id={module.sourceModuleId}
              >
                <div>
                  <p className="font-medium">{module.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {module.summary || 'No summary provided.'}
                  </p>
                </div>
                <Button
                  asChild
                  variant="secondary"
                  data-action="view_module"
                  data-module-id={module.id}
                >
                  <Link href={`/dashboard/modules/${module.id}`}>View</Link>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No modules available.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <section className="flex-1 p-4 lg:p-8" data-page="dashboard">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Dashboard</h1>
      <div className="grid gap-6">
        <SubscriptionStatus />
        <ModuleList />
      </div>
    </section>
  );
}
