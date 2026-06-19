import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function Eq({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: block, throwOnError: false }),
    [tex, block],
  );
  return (
    <span
      className={block ? 'eq-block' : 'eq-inline'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
