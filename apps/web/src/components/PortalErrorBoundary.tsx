"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  /** Optional: what section this wraps, for logging */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Portal Error Boundary
 * 
 * Catches any rendering error in children and shows a fallback UI
 * instead of crashing the entire page to a white screen.
 * 
 * Usage:
 *   <PortalErrorBoundary section="notifications">
 *     <SomeRiskyComponent />
 *   </PortalErrorBoundary>
 */
export class PortalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[PortalErrorBoundary${this.props.section ? `:${this.props.section}` : ""}] Caught error:`,
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-2">
          <p className="text-sm font-medium text-red-800">
            Something went wrong{this.props.section ? ` in ${this.props.section}` : ""}.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
