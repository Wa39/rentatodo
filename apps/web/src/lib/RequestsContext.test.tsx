import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockRequests } from './mockData'
import { RequestsProvider, useRequests } from './RequestsContext'

function Probe() {
  const { requests, setStatus } = useRequests()
  const first = requests[0]
  return (
    <div>
      <span data-testid="count">{requests.length}</span>
      <span data-testid="first-status">{first.status}</span>
      <button onClick={() => setStatus(first.id, 'approved')}>approve</button>
    </div>
  )
}

describe('RequestsContext', () => {
  it('starts seeded with mockRequests', () => {
    render(
      <RequestsProvider>
        <Probe />
      </RequestsProvider>,
    )
    expect(screen.getByTestId('count')).toHaveTextContent(String(mockRequests.length))
  })

  it('setStatus updates the matching reservation by id', () => {
    render(
      <RequestsProvider>
        <Probe />
      </RequestsProvider>,
    )
    act(() => screen.getByText('approve').click())
    expect(screen.getByTestId('first-status')).toHaveTextContent('approved')
  })

  it('throws when useRequests is called outside a provider', () => {
    function Bare() {
      useRequests()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useRequests must be used within a RequestsProvider')
  })
})
