import Link from 'next/link';
import { Icon } from './icon';

export function ActivityBackLink({ published = false }: { published?: boolean }) {
  return <Link className="activity-back-link" href={published ? '/system?view=published' : '/system?view=activities'} prefetch={false}><Icon name="arrowLeft" />Quay lại</Link>;
}
