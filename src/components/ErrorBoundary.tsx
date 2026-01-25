import { Component, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { typography } from '../utils/typography';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-altivum-dark flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-altivum-gold/10 border-2 border-altivum-gold mb-8">
              <span className="material-icons text-altivum-gold text-4xl">error_outline</span>
            </div>

            <h1 className="text-white mb-4" style={typography.sectionHeader}>
              Something went wrong
            </h1>

            <p className="text-altivum-silver mb-8" style={typography.bodyText}>
              We encountered an unexpected error. Please try refreshing the page or return to the home page.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-altivum-gold text-altivum-dark font-medium uppercase tracking-wider text-sm hover:bg-white transition-colors duration-300"
              >
                Refresh Page
              </button>
              <Link
                to="/"
                onClick={this.handleReset}
                className="px-6 py-3 border border-altivum-gold text-altivum-gold font-medium uppercase tracking-wider text-sm hover:bg-altivum-gold hover:text-altivum-dark transition-colors duration-300"
              >
                Go Home
              </Link>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-8 text-left">
                <summary className="text-altivum-silver cursor-pointer hover:text-white text-sm">
                  Error Details
                </summary>
                <pre className="mt-4 p-4 bg-altivum-navy rounded text-xs text-red-400 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
