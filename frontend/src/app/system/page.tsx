import { notFound, redirect } from 'next/navigation';
import { UserWorkspace } from '@/components/user-workspace';
import { backendUrl, sessionHeaders } from '@/lib/backend';
import { workspaceViews, type WorkspaceData, type WorkspaceView } from '@/lib/workspace';
import { ActivityEditor } from '@/components/activity-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hệ thống', robots: { index: false, follow: false } };

export default async function SystemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const headers = await sessionHeaders();
  if (!headers.Cookie) redirect('/login');
  let response: Response;
  try { response = await fetch(backendUrl('system/workspace'), { headers: { ...headers, 'X-User-Activity': '1' }, cache: 'no-store', signal: AbortSignal.timeout(10000) }); }
  catch { return <div className="container not-found"><h1>Không thể tải dữ liệu</h1><p role="alert">Dịch vụ tạm thời không khả dụng.</p></div>; }
  if (response.status === 401) redirect('/login');
  if (!response.ok) return <div className="container not-found"><h1>Không thể tải dữ liệu</h1><p role="alert">Dịch vụ tạm thời không khả dụng.</p></div>;
  const data = await response.json() as WorkspaceData;
  const query = await searchParams;
  if (query.editor !== undefined) {
    if (data.user.role !== 'staff' || typeof query.editor !== 'string' || (query.editor !== 'new' && !/^[1-9]\d*$/.test(query.editor))) notFound();
    const id = query.editor === 'new' ? null : Number(query.editor);
    if (id !== null && (!Number.isSafeInteger(id) || id > 4294967295)) notFound();
    return <ActivityEditor key={`${data.user.id}:${query.editor}`} actorId={data.user.id} id={id} />;
  }
  const view = query.view ?? (data.user.role === 'admin' ? 'accounts' : 'activities');
  const allowed = data.user.role === 'admin' ? ['accounts', 'profile'] : data.user.role === 'staff' ? ['activities', 'published', 'evidenceReview', 'tasks', 'profile'] : ['activities', 'registrations', 'attendance', 'statistics', 'evidence', 'tasks', 'profile'];
  if (typeof view !== 'string' || !Object.hasOwn(workspaceViews, view) || !allowed.includes(view)) notFound();
  const activityId = query.activity === undefined ? null : Number(query.activity);
  if (activityId !== null && (!Number.isSafeInteger(activityId) || !data.activities.some((activity) => activity.id === activityId))) notFound();
  return <UserWorkspace key={`${view}:${activityId}`} data={data} view={view as WorkspaceView} activityId={activityId} />;
}
