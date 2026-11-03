import logoDark from './assets/reigner-logo-dark.svg'
import logoLight from './assets/reigner-logo-light.svg'

function App() {
  return (
    <main style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcSet={logoDark} />
        <img src={logoLight} alt="reigner" width={280} />
      </picture>
    </main>
  )
}

export default App
