import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "../lib/monitoring";
import ErrorScreen from "./ErrorScreen";

/** Shows a friendly screen instead of a blank page if something in the app crashes. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, `react${info.componentStack ? ":" + info.componentStack.split("\n")[1]?.trim() : ""}`);
  }

  render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children;
  }
}
