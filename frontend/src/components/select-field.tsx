import type { ComponentProps } from 'react';
import { Icon } from './icon';

export function SelectField({ className, ...props }: ComponentProps<'select'>) {
  return <span className="select-field">
    <select {...props} className={['select-control', className].filter(Boolean).join(' ')} />
    <Icon name="chevronDown" />
  </span>;
}
