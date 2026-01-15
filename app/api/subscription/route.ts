import { getSubscriptionForUser, getUser } from '@/lib/db/queries';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json(null, { status: 401 });
  }

  const subscription = await getSubscriptionForUser(user.id);
  return Response.json(subscription);
}
