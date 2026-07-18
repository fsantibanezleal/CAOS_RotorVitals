import { Component, type ReactNode } from 'react';

// Per-panel error boundary: a crash inside one analysis tab (e.g. a tool fed an edge-case real signal) renders a
// small inline message INSTEAD of unmounting the whole App to a blank page. The tab bar stays usable so the user
// can switch away. Resets when its key changes (we key it by the active tab id + source).
export class PanelBoundary extends Component<{ children: ReactNode; lang?: 'en' | 'es' }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const es = this.props.lang === 'es';
      return (
        <div className="rv-plot" style={{ padding: '1rem', color: 'var(--color-fg-faint)' }}>
          <div className="rv-plot-t">{es ? 'Esta herramienta no aplica a esta fuente' : 'This tool does not apply to this source'}</div>
          <p className="hint" style={{ marginTop: '0.4rem' }}>
            {es
              ? 'No se pudo computar esta vista sobre el dato actual (p. ej. una fuente sin la geometría o el formato que la herramienta requiere). Seleccionar otra pestaña o fuente.'
              : 'This view could not be computed on the current datum (e.g. a source lacking the geometry or format the tool needs). Pick another tab or source.'}
          </p>
          <p className="hint" style={{ opacity: 0.6, fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
