import { render, screen } from '@testing-library/react'
import StatCard from './StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total météores" value={42} />)
    expect(screen.getByText('Total météores')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders sub text when provided', () => {
    render(<StatCard label="Nuit record" value={8} sub="2025-08-12" />)
    expect(screen.getByText('2025-08-12')).toBeInTheDocument()
  })

  it('does not render sub when not provided', () => {
    const { container } = render(<StatCard label="Total" value={5} />)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(container.querySelector('.sub')).toBeNull()
  })

  it('applies data-color attribute on the value element', () => {
    render(<StatCard label="Total" value={5} color="accent" />)
    expect(screen.getByText('5')).toHaveAttribute('data-color', 'accent')
  })

  it('defaults to color "default"', () => {
    render(<StatCard label="Total" value={0} />)
    expect(screen.getByText('0')).toHaveAttribute('data-color', 'default')
  })
})
