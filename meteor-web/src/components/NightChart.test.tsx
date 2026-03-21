import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NightChart from './NightChart'

const nights = [
  { date: '2025-08-14', count: 5 },
  { date: '2025-08-15', count: 3 },
]

describe('NightChart', () => {
  it('returns null when nights is empty', () => {
    const { container } = render(
      <NightChart nights={[]} activeNight={null} onSelectNight={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a button per night', () => {
    render(<NightChart nights={nights} activeNight={null} onSelectNight={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('calls onSelectNight with the date when clicking a bar', async () => {
    const user = userEvent.setup()
    const onSelectNight = jest.fn()
    render(<NightChart nights={nights} activeNight={null} onSelectNight={onSelectNight} />)
    await user.click(screen.getByTitle('2025-08-14 — 5 météore(s)'))
    expect(onSelectNight).toHaveBeenCalledWith('2025-08-14')
  })

  it('calls onSelectNight with null when clicking the active bar', async () => {
    const user = userEvent.setup()
    const onSelectNight = jest.fn()
    render(<NightChart nights={nights} activeNight="2025-08-14" onSelectNight={onSelectNight} />)
    await user.click(screen.getByTitle('2025-08-14 — 5 météore(s)'))
    expect(onSelectNight).toHaveBeenCalledWith(null)
  })

  it('displays at most 30 bars when more than 30 nights are provided', () => {
    const manyNights = Array.from({ length: 35 }, (_, i) => ({
      date: `2025-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      count: i + 1,
    }))
    render(<NightChart nights={manyNights} activeNight={null} onSelectNight={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(30)
  })

  it('shows the count inside each bar', () => {
    render(<NightChart nights={nights} activeNight={null} onSelectNight={() => {}} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
