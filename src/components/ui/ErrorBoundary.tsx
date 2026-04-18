/** Error boundary component to isolate calendar UI runtime failures. */
'use client';

import type { ErrorInfo, ReactNode } from 'react';
import React from 'react';

interface ErrorBoundaryProps {
  fallback?: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Calendar UI crashed:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-sm text-red-300">
            Calendar view failed to render.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
