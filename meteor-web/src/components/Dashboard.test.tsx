import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard'

const mockResponse = {
  detections: [
    {
      timestamp: '2025-08-14T23:04:11.234',
      image: 'frame_001.jpg',
      meteor_count: 1,
      detections: [{ x1: 0, y1: 0, x2: 100, y2: 100, length: 141 }],
      annotated_filename: 'annotated_001.jpg',
      night: '2025-08-14',
    },
  ],
  stats: {
    totalMeteors: 42,
    totalImages: 38,
    tonight: 5,
    totalNights: 10,
    bestNightCount: 8,
    bestNightDate: '2025-08-12',
  },
  nights: [{ date: '2025-08-14', count: 5 }],
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => mockResponse,
  })
})

afterEach(() => jest.clearAllMocks())

describe('Dashboard', () => {
  it('shows the loading state before data is fetched', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) // never resolves
    render(<Dashboard />)
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })

  it('renders stat cards after fetch', async () => {
    render(<Dashboard />)
    expect(await screen.findByText('Total météores')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Cette nuit')).toBeInTheDocument()
  })

  it('renders detection cards after fetch', async () => {
    render(<Dashboard />)
    expect(await screen.findByText('2025-08-14 23:04:11')).toBeInTheDocument()
  })

  it('filters detections when a night bar is clicked', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)
    await screen.findByTitle('2025-08-14 — 5 météore(s)')
    await user.click(screen.getByTitle('2025-08-14 — 5 météore(s)'))
    expect(screen.getByText('Nuit du 2025-08-14')).toBeInTheDocument()
    expect(screen.getByText('✕ Toutes les nuits')).toBeInTheDocument()
  })

  it('resets the filter when clicking "Toutes les nuits"', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)
    await screen.findByTitle('2025-08-14 — 5 météore(s)')
    await user.click(screen.getByTitle('2025-08-14 — 5 météore(s)'))
    await user.click(screen.getByText('✕ Toutes les nuits'))
    expect(screen.getByText('Tous les météores')).toBeInTheDocument()
    expect(screen.queryByText('✕ Toutes les nuits')).not.toBeInTheDocument()
  })
})
