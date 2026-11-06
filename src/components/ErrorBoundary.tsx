import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

/** Without this, an error while rendering leaves a blank window. Must be a class: hooks can't catch it. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <main className="setup">
        <h1>화면을 표시하지 못했습니다</h1>
        <p>저장한 기사 파일은 저장 폴더에 그대로 있습니다.</p>
        <p className="message error">{error instanceof Error ? error.message : String(error)}</p>
        <div className="actions error-actions">
          <button type="button" onClick={() => window.location.reload()}>
            다시 불러오기
          </button>
        </div>
      </main>
    );
  }
}
