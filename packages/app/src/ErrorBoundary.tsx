"use client";

import { Component, type ReactNode } from "react";

import ErrorScreen from "../../../src/components/shell/ErrorScreen.ts";
import { messagesHr as t } from "../../../locales/hr.ts";

type Props = {
  children: ReactNode;
  /** Told that a render failed; never given the error itself. */
  onError?: () => void;
};
type State = { failed: boolean };

/**
 * DAN-1568: the boundary around the whole app. A screen that throws while it
 * renders leaves the existing ErrorScreen instead of an empty page. "Pokušaj
 * ponovno" renders the app again; the session is read anew by App.
 *
 * Nothing of the error is shown or kept: its message can quote a value.
 */
export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(): void {
    try {
      this.props.onError?.();
    } catch {
      // A report that fails must not replace the error screen with another error.
    }
  }

  retry = (): void => this.setState({ failed: false });

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <ErrorScreen title={t.errorPage.errorTitle} body={t.errorPage.errorBody} onRetry={this.retry} />;
  }
}
