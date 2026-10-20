import { Fragment, type ReactNode } from 'react';

/**
 * Remounts its children whenever `markup` changes. The previous renderer rebuilt these parts
 * through innerHTML whenever their markup changed, so a moved focus or a new label snapped into
 * place instead of running the element's CSS transition. Keying by the rendered data keeps that.
 */
export function Rebuilt({ markup, children }: { markup: string; children: ReactNode }) {
  return <Fragment key={markup}>{children}</Fragment>;
}
