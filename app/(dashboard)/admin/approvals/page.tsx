"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type Run } from "@/lib/db/schema";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminApprovalsPage() {
  const { data: runs, mutate } = useSWR<Run[]>("/api/runs", fetcher);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function submitApproval(
    runId: number,
    decision: "approve" | "reject",
    rationale: string
  ) {
    if (rationale.trim().length < 3) {
      setStatusMessage("APPROVE_RUN_VALIDATION_ERROR");
      return;
    }
    const response = await fetch(`/api/approvals/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, rationale }),
    });

    if (response.ok) {
      setStatusMessage(
        decision === "approve" ? "APPROVE_RUN_SUCCESS" : "REJECT_RUN_SUCCESS"
      );
      mutate();
    } else {
      setStatusMessage("APPROVE_RUN_FAILED");
    }
  }

  async function promoteRun(runId: number, rationale: string) {
    if (rationale.trim().length < 3) {
      setStatusMessage("PROMOTE_RUN_VALIDATION_ERROR");
      return;
    }
    const response = await fetch(`/api/promote/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rationale }),
    });

    if (response.ok) {
      setStatusMessage("PROMOTE_RUN_SUCCESS");
      mutate();
    } else {
      setStatusMessage("PROMOTE_RUN_FAILED");
    }
  }

  const pendingRuns = runs?.filter((run) => run.status === "proposed") || [];
  const approvedRuns = runs?.filter((run) => run.status === "approved") || [];
  const getCiStatus = (run: Run) => {
    const evaluation = run.evaluationJson as
      | { ci?: { status?: string } }
      | null
      | undefined;
    return evaluation?.ci?.status;
  };
  const formatDiff = (run: Run) =>
    run.diffJson ? JSON.stringify(run.diffJson, null, 2) : "No diff payload.";

  return (
    <section className="flex-1 p-4 lg:p-8" data-page="admin_approvals">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">
        Approvals & Promote
      </h1>
      {statusMessage && (
        <p
          className="text-sm text-muted-foreground mb-4"
          data-status-code={statusMessage}
        >
          {statusMessage}
        </p>
      )}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Proposals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingRuns.length ? (
              pendingRuns.map((run) => (
                <div key={run.id} className="border rounded-md p-4">
                  <p className="font-medium">{run.diffSummary}</p>
                  <p className="text-sm text-muted-foreground">
                    Action: {run.actionType}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <Link
                      href={`/admin/runs#run-${run.id}`}
                      className="text-blue-600 underline"
                      data-action="view_run"
                    >
                      View full run details
                    </Link>
                    <Link
                      href={`/admin/audit?entityType=run&entityId=${run.id}`}
                      className="text-blue-600 underline"
                      data-action="view_audit"
                    >
                      View audit log entries
                    </Link>
                  </div>
                  <div className="mt-3 text-xs bg-gray-50 border rounded p-3 overflow-auto">
                    <pre>{formatDiff(run)}</pre>
                  </div>
                  {getCiStatus(run) !== "passed" ? (
                    <p className="text-xs text-amber-600 mt-2">
                      Warning: CI evaluation is missing or not passing.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-3">
                    <Input
                      placeholder="Approval rationale"
                      data-form={`approve_rationale_${run.id}`}
                      id={`approve_rationale_${run.id}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        data-action="approve_run"
                        onClick={() => {
                          const input = document.getElementById(
                            `approve_rationale_${run.id}`
                          ) as HTMLInputElement | null;
                          submitApproval(run.id, "approve", input?.value || "");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        data-action="reject_run"
                        onClick={() => {
                          const input = document.getElementById(
                            `approve_rationale_${run.id}`
                          ) as HTMLInputElement | null;
                          submitApproval(run.id, "reject", input?.value || "");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No pending proposals.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approved Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {approvedRuns.length ? (
              approvedRuns.map((run) => (
                <div key={run.id} className="border rounded-md p-4">
                  <p className="font-medium">{run.diffSummary}</p>
                  <p className="text-sm text-muted-foreground">
                    Approved, ready to promote.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <Link
                      href={`/admin/runs#run-${run.id}`}
                      className="text-blue-600 underline"
                      data-action="view_run"
                    >
                      View full run details
                    </Link>
                    <Link
                      href={`/admin/audit?entityType=run&entityId=${run.id}`}
                      className="text-blue-600 underline"
                      data-action="view_audit"
                    >
                      View audit log entries
                    </Link>
                  </div>
                  <div className="mt-3 text-xs bg-gray-50 border rounded p-3 overflow-auto">
                    <pre>{formatDiff(run)}</pre>
                  </div>
                  {getCiStatus(run) !== "passed" ? (
                    <p className="text-xs text-amber-600 mt-2">
                      Warning: CI evaluation is missing or not passing.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-3">
                    <Input
                      placeholder="Promotion rationale"
                      data-form={`promote_rationale_${run.id}`}
                      id={`promote_rationale_${run.id}`}
                    />
                    <Button
                      data-action="promote_run"
                      onClick={() => {
                        const input = document.getElementById(
                          `promote_rationale_${run.id}`
                        ) as HTMLInputElement | null;
                        promoteRun(run.id, input?.value || "");
                      }}
                    >
                      Promote to Prod
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No approved runs awaiting promotion.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
