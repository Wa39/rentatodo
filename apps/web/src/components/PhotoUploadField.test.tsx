import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoUploadField } from './PhotoUploadField'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]

const PRESIGN_PAYLOAD = {
  upload_url: 'https://s3.example.com/upload?sig=abc',
  public_url: 'https://s3.example.com/uploads/u1/abc.jpg',
  expires_in: 300,
}

describe('PhotoUploadField', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({} as ImageBitmap))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows "Choose photo" and no preview when value is empty', () => {
    render(<PhotoUploadField id="photo" label="Photo" value="" onChange={vi.fn()} token="tok123" />)
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the existing photo and "Replace photo" when value is already set', () => {
    render(
      <PhotoUploadField id="photo" label="Photo" value="https://example.com/existing.jpg" onChange={vi.fn()} token="tok123" />,
    )
    expect(screen.getByRole('button', { name: 'Replace photo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Photo' })).toHaveAttribute('src', 'https://example.com/existing.jpg')
  })

  it('uploads a selected valid file and calls onChange with the resulting public_url', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(PRESIGN_PAYLOAD, 200))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
    const onChange = vi.fn()
    const user = userEvent.setup({ delay: null })
    render(<PhotoUploadField id="photo" label="Photo" value="" onChange={onChange} token="tok123" />)

    const file = makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg')
    await user.upload(screen.getByLabelText('Photo'), file)

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(PRESIGN_PAYLOAD.public_url))
    expect(screen.getByRole('img', { name: 'Photo' })).toBeInTheDocument()
  })

  it('shows an inline error and does not call onChange when the file type is invalid', async () => {
    const onChange = vi.fn()
    // applyAccept: false — user-event filters files against the input's `accept`
    // attribute by default, which would silently drop this PDF before any change
    // event fires. The component's own validation (not the browser's accept hint)
    // is what this test is exercising.
    const user = userEvent.setup({ delay: null, applyAccept: false })
    render(<PhotoUploadField id="photo" label="Photo" value="" onChange={onChange} token="tok123" />)

    const file = makeFile([0x25, 0x50, 0x44, 0x46], 'doc.pdf', 'application/pdf')
    await user.upload(screen.getByLabelText('Photo'), file)

    await waitFor(() => expect(screen.getByText('Please choose a JPEG, PNG, or WEBP image.')).toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('reports uploading state via onUploadingChange while the upload is in flight', async () => {
    let resolvePut: (value: Response) => void = () => {}
    const pendingPut = new Promise<Response>((resolve) => {
      resolvePut = resolve
    })
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(PRESIGN_PAYLOAD, 200)).mockReturnValueOnce(pendingPut)
    const onUploadingChange = vi.fn()
    const user = userEvent.setup({ delay: null })
    render(
      <PhotoUploadField
        id="photo"
        label="Photo"
        value=""
        onChange={vi.fn()}
        onUploadingChange={onUploadingChange}
        token="tok123"
      />,
    )

    const file = makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg')
    await user.upload(screen.getByLabelText('Photo'), file)

    await waitFor(() => expect(onUploadingChange).toHaveBeenCalledWith(true))
    resolvePut({ ok: true, status: 200 } as Response)
    await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false))
  })
})
