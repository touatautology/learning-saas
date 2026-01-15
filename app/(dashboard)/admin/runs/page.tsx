"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Run } from "@/lib/db/schema";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminRunsPage() {
  const { data: runs } = useSWR<Run[]>("/api/runs", fetcher);

  return (
    <section className="flex-1 p-4 lg:p-8" data-page="admin_runs">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Runs & Diffs</h1>
      <div className="grid gap-6">
        {runs?.length ? (
          runs.map((run) => (
            <Card key={run.id} data-run-id={run.id} id={`run-${run.id}`}>
              <CardHeader>
                <CardTitle>
                  {run.actionType} · {run.status}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Environment: {run.environment}
                </p>
                <p className="text-sm text-muted-foreground">
                  Summary: {run.diffSummary}
                </p>
                <div className="text-xs bg-gray-50 border rounded p-3 overflow-auto">
                  <pre>{JSON.stringify(run.diffJson, null, 2)}</pre>
                </div>
                <div className="text-xs bg-gray-50 border rounded p-3 overflow-auto">
                  <pre>{JSON.stringify(run.evaluationJson, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No runs yet.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
