import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-xl mx-auto my-8 bg-rose-50 border border-rose-200 rounded-3xl shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-rose-950">התרחשה שגיאה בעת טעינת התצוגה</h2>
            <p className="text-xs text-rose-700 mt-1">
              {this.state.error?.message || 'שגיאה לא צפויה ברינדור הרכיב'}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="py-2.5 px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center gap-2 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>נסה שוב / רענן עמוד</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
