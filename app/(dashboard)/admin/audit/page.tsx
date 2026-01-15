"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type AuditEntry = {
  id: number;
  action: string;
  createdAt: string;
  actorRole: string | null;
  actorUserId: number | null;
  environment: string | null;
  entityType: string | null;
  entityId: string | null;
  success: boolean;
  ipAddress: string | null;
  actorName: string | null;
  actorEmail: string | null;
};

export default function AdminAuditPage() {
  const { data: logs } = useSWR<AuditEntry[]>("/api/audit", fetcher);

  return (
    <section className="flex-1 p-4 lg:p-8" data-page="admin_audit">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Audit Log</h1>
      <div className="grid gap-4">
        {logs?.length ? (
          logs.map((log) => (
            <Card key={log.id}>
              <CardHeader>
                <CardTitle>
                  {log.action} {log.success ? "OK" : "FAILED"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>Actor: {log.actorEmail || "unknown"}</p>
                <p>Role: {log.actorRole || "n/a"}</p>
                <p>Entity: {log.entityType || "n/a"} {log.entityId || ""}</p>
                <p>Env: {log.environment || "n/a"}</p>
                <p>At: {new Date(log.createdAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No audit logs.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
