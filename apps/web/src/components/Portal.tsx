import { useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
  container?: HTMLElement;
}

export function Portal({ children, container }: PortalProps) {
  const defaultContainer = useRef<HTMLDivElement | null>(null);

  if (!container && !defaultContainer.current) {
    const div = document.createElement('div');
    div.setAttribute('data-portal-container', 'true');
    document.body.appendChild(div);
    defaultContainer.current = div;
  }

  useEffect(() => {
    return () => {
      if (defaultContainer.current && !container) {
        document.body.removeChild(defaultContainer.current);
        defaultContainer.current = null;
      }
    };
  }, [container]);

  const targetContainer = container || defaultContainer.current;

  return createPortal(children, targetContainer);
}
