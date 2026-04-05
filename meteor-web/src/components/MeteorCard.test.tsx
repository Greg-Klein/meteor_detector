import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MeteorCard from './MeteorCard'
import { Detection } from '@/types/meteor'

const detection: Detection = {
  timestamp: '2025-08-14T23:04:11.234',
  image: 'frame_001.jpg',
  meteor_count: 1,
  detections: [{ x1: 0, y1: 0, x2: 100, y2: 100, length: 141 }],
  annotated_filename: 'annotated_001.jpg',
  night: '2025-08-14',
}

beforeEach(() => {
  global.fetch = jest.fn()
  jest.clearAllMocks()
})

describe('MeteorCard', () => {
  it('renders the formatted timestamp', () => {
    render(<MeteorCard detection={detection} />)
    expect(screen.getByText('2025-08-14 23:04:11')).toBeInTheDocument()
  })

  it('renders the segment length in pixels', () => {
    render(<MeteorCard detection={detection} />)
    expect(screen.getByText('141 px')).toBeInTheDocument()
  })

  it('does not render the action buttons without callbacks', () => {
    render(<MeteorCard detection={detection} />)
    expect(screen.queryByRole('button', { name: 'Faux positif' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Valider' })).not.toBeInTheDocument()
  })

  it('renders the false positive button when onFalsePositive is provided', () => {
    render(<MeteorCard detection={detection} onFalsePositive={() => {}} />)
    expect(screen.getByRole('button', { name: 'Faux positif' })).toBeInTheDocument()
  })

  it('renders the positive button when onMarkPositive is provided', () => {
    render(<MeteorCard detection={detection} onMarkPositive={() => {}} />)
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
  })

  it('opens the confirm modal on false positive button click', async () => {
    const user = userEvent.setup()
    render(<MeteorCard detection={detection} onFalsePositive={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Faux positif' }))
    expect(screen.getByRole('button', { name: 'Exclure' })).toBeInTheDocument()
  })

  it('closes the modal without calling fetch when cancelling', async () => {
    const user = userEvent.setup()
    render(<MeteorCard detection={detection} onFalsePositive={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Faux positif' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('button', { name: 'Exclure' })).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls fetch and onFalsePositive when confirming', async () => {
    const user = userEvent.setup()
    const onFalsePositive = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    render(<MeteorCard detection={detection} onFalsePositive={onFalsePositive} />)
    await user.click(screen.getByRole('button', { name: 'Faux positif' }))
    await user.click(screen.getByRole('button', { name: 'Exclure' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/detections/false-positive',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ timestamp: detection.timestamp }),
        })
      )
      expect(onFalsePositive).toHaveBeenCalledTimes(1)
    })
  })

  it('calls fetch and marks the detection as positive when confirming', async () => {
    const user = userEvent.setup()
    const onMarkPositive = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    render(<MeteorCard detection={detection} onMarkPositive={onMarkPositive} />)
    await user.click(screen.getByRole('button', { name: 'Valider' }))
    await user.click(screen.getAllByRole('button', { name: 'Valider' })[1])

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/detections/positive',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ timestamp: detection.timestamp }),
        })
      )
      expect(onMarkPositive).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Marquee' })).toBeDisabled()
    })
  })

  it('does not call onFalsePositive when the API returns an error', async () => {
    const user = userEvent.setup()
    const onFalsePositive = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

    render(<MeteorCard detection={detection} onFalsePositive={onFalsePositive} />)
    await user.click(screen.getByRole('button', { name: 'Faux positif' }))
    await user.click(screen.getByRole('button', { name: 'Exclure' }))

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(onFalsePositive).not.toHaveBeenCalled()
  })

  it('opens the lightbox when clicking the image', async () => {
    const user = userEvent.setup()
    render(<MeteorCard detection={detection} />)
    await user.click(screen.getByAltText('Météore détecté'))
    expect(screen.getByAltText('Météore')).toBeInTheDocument()
  })
})
