import ModuleEditorClient from './module-editor-client';

export default async function AdminModuleEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ModuleEditorClient moduleId={id} />;
}
