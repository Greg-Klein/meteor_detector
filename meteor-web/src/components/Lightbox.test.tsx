import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Lightbox from './Lightbox'

const defaultProps = {
  src: '/api/images/test.jpg',
  caption: '2025-08-14 23:04:11  ·  120 px',
  onClose: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('Lightbox', () => {
  it('renders the image with the correct src', () => {
    render(<Lightbox {...defaultProps} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/api/images/test.jpg')
  })

  it('renders the caption', () => {
    render(<Lightbox {...defaultProps} />)
    expect(screen.getByText(/23:04:11.*120 px/)).toBeInTheDocument()
  })

  it('calls onClose when clicking the close button', async () => {
    const user = userEvent.setup()
    render(<Lightbox {...defaultProps} />)
    await user.click(screen.getByRole('button'))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when pressing Escape', () => {
    render(<Lightbox {...defaultProps} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose for keys other than Escape', () => {
    render(<Lightbox {...defaultProps} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when clicking the backdrop', () => {
    const { container } = render(<Lightbox {...defaultProps} />)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })
})
