import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmModal from './ConfirmModal'

const defaultProps = {
  message: 'Êtes-vous sûr ?',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('ConfirmModal', () => {
  it('renders the message', () => {
    render(<ConfirmModal {...defaultProps} />)
    expect(screen.getByText('Êtes-vous sûr ?')).toBeInTheDocument()
  })

  it('renders "Confirmer" as default confirm label', () => {
    render(<ConfirmModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeInTheDocument()
  })

  it('renders a custom confirmLabel', () => {
    render(<ConfirmModal {...defaultProps} confirmLabel="Exclure" />)
    expect(screen.getByRole('button', { name: 'Exclure' })).toBeInTheDocument()
  })

  it('calls onCancel when clicking Annuler', async () => {
    const user = userEvent.setup()
    render(<ConfirmModal {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when clicking the confirm button', async () => {
    const user = userEvent.setup()
    render(<ConfirmModal {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when clicking the backdrop', () => {
    const { container } = render(<ConfirmModal {...defaultProps} />)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not call onCancel when clicking inside the modal', async () => {
    const user = userEvent.setup()
    render(<ConfirmModal {...defaultProps} />)
    await user.click(screen.getByText('Êtes-vous sûr ?'))
    expect(defaultProps.onCancel).not.toHaveBeenCalled()
  })
})
