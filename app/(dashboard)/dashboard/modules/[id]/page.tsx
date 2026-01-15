'use client';

import { use } from 'react';
import useSWR from 'swr';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type LearningModule } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: module } = useSWR<LearningModule>(
    `/api/modules/${id}`,
    fetcher
  );

  if (!module) {
    return (
      <section className="flex-1 p-4 lg:p-8" data-page="module_detail">
        <p className="text-sm text-muted-foreground">Loading module...</p>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8" data-page="module_detail">
      <Card>
        <CardHeader>
          <CardTitle>{module.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-xs text-muted-foreground"
            data-source-module-id={module.sourceModuleId}
          >
            Source ID: {module.sourceModuleId}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {module.summary}
          </p>
          <div
            className="prose max-w-none"
            data-section="module_body"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                marked.parse(module.bodyMarkdown, { async: false }) as string,
                {
                  ALLOWED_TAGS: [
                    'p',
                    'strong',
                    'em',
                    'ul',
                    'ol',
                    'li',
                    'code',
                    'pre',
                    'h1',
                    'h2',
                    'h3',
                    'h4',
                    'blockquote',
                    'a',
                    'br',
                    'hr',
                  ],
                  ALLOWED_ATTR: ['href', 'target', 'rel'],
                  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
                }
              ),
            }}
          />
          <div className="mt-6">
            <h3 className="font-medium mb-2">Checklist</h3>
            <ul className="space-y-3">
              {Array.isArray(module.checklistJson) ? (
                module.checklistJson.map((item: any, index: number) => (
                  <li key={index} className="border rounded-md p-3">
                    <p className="font-medium">{item.step}</p>
                    <p className="text-sm text-muted-foreground">
                      Success: {item.successCriteria}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Pitfalls: {item.commonMistakes}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Verify: {item.verification}
                    </p>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">
                  No checklist items.
                </li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
