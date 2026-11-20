import { Component, type ReactNode } from "react";
import { translations } from "../i18n/translations";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const lang = document.documentElement.lang;
    const dict = translations[lang === "en" || lang === "kk" ? lang : "ru"];
    return (
      <div className="page narrow state-box" role="alert">
        <h1>{dict["errors.generic"]}</h1>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          {dict["common.retry"]}
        </button>
      </div>
    );
  }
}
