// Fix for lucide-react type issues with React 18
// This resolves the "cannot be used as a JSX component" error
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

declare module 'lucide-react' {
  export type Icon = ForwardRefExoticComponent<
    Omit<SVGProps<SVGSVGElement>, 'ref'> & {
      title?: string;
      titleId?: string;
    } & RefAttributes<SVGSVGElement>
  >;
}
