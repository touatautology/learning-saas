'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type LearningModule, type User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const defaultChecklist = [
  {
    step: 'Describe the action',
    successCriteria: 'Define success',
    commonMistakes: 'List pitfalls',
    verification: 'How to verify',
  },
];

export default function AdminModulesPage() {
  const { data: modules, mutate } = useSWR<LearningModule[]>(
    '/api/modules?environment=staging',
    fetcher
  );
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    let checklistJson = [];
    try {
      checklistJson = JSON.parse(
        (formData.get('checklistJson') as string) || '[]'
      );
    } catch (error) {
      setStatusMessage('CHECKLIST_JSON_INVALID');
      return;
    }

    const payload = {
      title: formData.get('title'),
      summary: formData.get('summary'),
      bodyMarkdown: formData.get('bodyMarkdown'),
      checklistJson,
      status: formData.get('status'),
      environment: formData.get('environment') || 'staging',
      rationale: formData.get('rationale'),
    };

    const response = await fetch('/api/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      setStatusMessage('SAVE_MODULE_SUCCESS');
      mutate();
    } else {
      setStatusMessage('SAVE_MODULE_FAILED');
    }
  }

  return (
    <section className="flex-1 p-4 lg:p-8" data-page="admin_modules">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">
        Module Management
      </h1>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Module (Staging)</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              data-form="create_module"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                await handleCreate(formData);
                event.currentTarget.reset();
              }}
            >
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div>
                <Label htmlFor="summary">Summary</Label>
                <Input id="summary" name="summary" />
              </div>
              <div>
                <Label htmlFor="bodyMarkdown">Body (Markdown)</Label>
                <Textarea id="bodyMarkdown" name="bodyMarkdown" required />
              </div>
              <div>
                <Label htmlFor="checklistJson">Checklist JSON</Label>
                <Textarea
                  id="checklistJson"
                  name="checklistJson"
                  defaultValue={JSON.stringify(defaultChecklist, null, 2)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  className="border rounded-md h-10 px-3"
                  defaultValue="draft"
                >
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="environment">Environment</Label>
                <select
                  id="environment"
                  name="environment"
                  className="border rounded-md h-10 px-3"
                  defaultValue="staging"
                  disabled={user?.role === 'AGENT'}
                >
                  <option value="staging">staging</option>
                  <option value="prod">prod</option>
                </select>
              </div>
              <div>
                <Label htmlFor="rationale">Rationale</Label>
                <Input id="rationale" name="rationale" required />
              </div>
              {statusMessage && (
                <p
                  className="text-sm text-muted-foreground"
                  data-status-code={statusMessage}
                >
                  {statusMessage}
                </p>
              )}
              <Button type="submit" data-action="save_module">
                Save Module
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staging Modules</CardTitle>
          </CardHeader>
          <CardContent>
            {modules?.length ? (
              <div className="space-y-3">
                {modules.map((module) => (
                  <div
                    key={module.id}
                    className="border rounded-md p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{module.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {module.summary}
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      data-action="edit_module"
                    >
                      <Link href={`/admin/modules/${module.id}`}>Edit</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No staging modules yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
