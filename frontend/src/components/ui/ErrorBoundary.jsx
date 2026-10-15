import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center border border-rose-200 dark:border-rose-900/50 rounded-card bg-rose-50/50 dark:bg-rose-950/20 my-4">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/40 text-rose-600 rounded-full mb-3">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h4 className="text-base font-semibold text-rose-900 dark:text-rose-200">
            Something went wrong
          </h4>
          <p className="text-sm text-rose-700 dark:text-rose-400 mt-1 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred while rendering this component.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            icon={RefreshCw}
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
