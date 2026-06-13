import { Component } from 'react'

// Prevents a render-time exception from blanking the whole page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <header className="header">
            <h1>ChessAnalyzer</h1>
            <p>Something went wrong</p>
          </header>
          <div className="content">
            <div className="panel">
              <p className="error">{String(this.state.error?.message || this.state.error)}</p>
              <button className="btn primary block" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
