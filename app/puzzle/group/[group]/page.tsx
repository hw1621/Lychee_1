import { addRecentGroup } from '@/app/api/dashboard/recentGroups';
import nextPuzzleFor from '@/app/api/puzzle/nextPuzzle/nextFor';
import ThemeMode from '@/components/theme-trainer/theme-mode';
import { validateRequest } from '@/lib/auth';
import { toGroup } from '@/lib/utils';
import { redirect } from 'next/navigation';

export default async function Group({ params }: { params: { group: string } }) {
  const { user } = await validateRequest();
  if (!user) {
    return redirect('/');
  }
  const group = toGroup(params.group);
  if (group.length === 0) {
    return redirect('/');
  }
  addRecentGroup(user.username, params.group);
  const { puzzle, rating } = await nextPuzzleFor(user, false, group);
  return (
    <ThemeMode initialPuzzle={puzzle} initialRating={rating} group={group} />
  );
}
