'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type LearningModule, type User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminModuleEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: module, mutate } = useSWR<LearningModule>(
    `/api/modules/${params.id}`,
    fetcher
  );
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleUpdate(formData: FormData) {
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
      environment: formData.get('environment') || module.environment,
      rationale: formData.get('rationale'),
    };

    const response = await fetch(`/api/modules/${params.id}`, {
      method: 'PUT',
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

  if (!module) {
    return (
      <section className="flex-1 p-4 lg:p-8" data-page="admin_module_editor">
        <p className="text-sm text-muted-foreground">Loading module...</p>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8" data-page="admin_module_editor">
      <Card>
        <CardHeader>
          <CardTitle>Edit Module</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            data-form="edit_module"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              await handleUpdate(formData);
            }}
          >
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={module.title} />
            </div>
            <div>
              <Label htmlFor="summary">Summary</Label>
              <Input id="summary" name="summary" defaultValue={module.summary || ''} />
            </div>
            <div>
              <Label htmlFor="bodyMarkdown">Body (Markdown)</Label>
              <Textarea
                id="bodyMarkdown"
                name="bodyMarkdown"
                defaultValue={module.bodyMarkdown}
              />
            </div>
            <div>
              <Label htmlFor="checklistJson">Checklist JSON</Label>
              <Textarea
                id="checklistJson"
                name="checklistJson"
                defaultValue={JSON.stringify(module.checklistJson, null, 2)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className="border rounded-md h-10 px-3"
                defaultValue={module.status}
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
                defaultValue={module.environment}
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
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
