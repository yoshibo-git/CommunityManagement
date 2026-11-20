import Link from 'next/link';
import { Icon } from './icon';

export function ActivityBackLink() {
  return <Link className="activity-back-link" href="/system?view=activities" prefetch={false}><Icon name="arrowLeft" />Quay lại</Link>;
}
