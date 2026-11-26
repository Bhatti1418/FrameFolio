import { useEffect, useState } from 'react'
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react'
import { generateClient } from 'aws-amplify/data'
import { fetchAuthSession } from 'aws-amplify/auth'
import { get } from 'aws-amplify/api'
import { remove } from 'aws-amplify/storage'
import { FileUploader, StorageImage } from '@aws-amplify/ui-react-storage'
import type { Schema } from '../amplify/data/resource'
import '@aws-amplify/ui-react/styles.css'
import './App.css'

const client = generateClient<Schema>()

type Photo = Schema['Photo']['type']
type RestResult = {
  loading: boolean
  value?: string
  error?: string
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function Dashboard() {
  const { user, signOut } = useAuthenticator((context) => [context.user])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photosLoading, setPhotosLoading] = useState(true)
  const [photosError, setPhotosError] = useState('')
  const [identity, setIdentity] = useState({ email: user.username, groups: [] as string[], username: user.username })
  const [identityError, setIdentityError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [publicResult, setPublicResult] = useState<RestResult>({ loading: false })
  const [protectedResult, setProtectedResult] = useState<RestResult>({ loading: false })

  useEffect(() => {
    let active = true
    fetchAuthSession()
      .then((session) => {
        if (!active) return
        const payload = session.tokens?.idToken?.payload
        const groupClaim = payload?.['cognito:groups']
        const groups = Array.isArray(groupClaim)
          ? groupClaim.filter((group): group is string => typeof group === 'string')
          : typeof groupClaim === 'string'
            ? [groupClaim]
            : []
        const username = typeof payload?.['cognito:username'] === 'string'
          ? payload['cognito:username']
          : user.username
        setIdentity({
          email: typeof payload?.email === 'string' ? payload.email : user.username,
          groups,
          username,
        })
      })
      .catch((error: unknown) => {
        if (active) setIdentityError(messageFromError(error))
      })

    return () => {
      active = false
    }
  }, [user.username])

  useEffect(() => {
    const subscription = client.models.Photo.observeQuery().subscribe({
      next: ({ items, isSynced }) => {
        setPhotos(items)
        if (isSynced) setPhotosLoading(false)
      },
      error: (error: unknown) => {
        setPhotosError(messageFromError(error))
        setPhotosLoading(false)
      },
    })

    return () => subscription.unsubscribe()
  }, [])

  const createPhotoRecord = async (key?: string) => {
    if (!key) {
      setUploadError('The upload completed without returning an S3 key.')
      setUploading(false)
      return
    }

    const response = await client.models.Photo.create({
      title: title.trim() || key.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Untitled photo',
      description: description.trim(),
      s3Key: key,
    })
    if (response.errors?.length) {
      throw new Error(response.errors.map((error) => error.message).join('; '))
    }
    const photo = response.data
    if (!photo) {
      throw new Error('The image uploaded, but the Photo record was not returned by the API.')
    }

    setPhotos((currentPhotos) => [
      photo,
      ...currentPhotos.filter((existingPhoto) => existingPhoto.id !== photo.id),
    ])
    setPhotosLoading(false)
    setTitle('')
    setDescription('')
    setUploading(false)
  }

  const runRestRequest = async (path: '/hello' | '/me') => {
    const isProtected = path === '/me'
    const updateResult = isProtected ? setProtectedResult : setPublicResult
    updateResult({ loading: true })

    try {
      const options = isProtected
        ? (() => {
            return fetchAuthSession().then((session) => {
              const token = session.tokens?.idToken?.toString()
              if (!token) throw new Error('No ID token is available. Please sign in again.')
              return get({
                apiName: 'photo-rest-api',
                path,
                options: { headers: { Authorization: token } },
              }).response
            })
          })()
        : get({ apiName: 'photo-rest-api', path }).response
      const response = await options
      const body = await response.body.json()
      updateResult({ loading: false, value: JSON.stringify(body, null, 2) })
    } catch (error) {
      updateResult({ loading: false, error: messageFromError(error) })
    }
  }

  const deletePhoto = async (photo: Photo) => {
    setDeletingId(photo.id)
    setDeleteError('')
    try {
      const response = await client.models.Photo.delete({ id: photo.id })
      if (response.errors?.length) {
        throw new Error(response.errors.map((error) => error.message).join('; '))
      }
      await remove({ path: photo.s3Key })
    } catch (error) {
      setDeleteError(`Could not delete "${photo.title}": ${messageFromError(error)}`)
    } finally {
      setDeletingId('')
    }
  }

  const isOwner = (photo: Photo) => {
    const owner = photo.owner
    return typeof owner === 'string' && owner.split('::').includes(identity.username)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Frame home">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span>frame<span className="brand-period">.</span></span>
        </a>
        <div className="account">
          <div className="account-copy">
            <span className="account-label">Signed in as</span>
            <span className="account-email">{identity.email}</span>
          </div>
          <span className="group-badge">{identity.groups.join(', ') || 'No group'}</span>
          <button className="button button-quiet" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="main-content">
        <section className="intro">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PRIVATE PHOTO SPACE</div>
          <h1>A place for the<br /><em>moments worth keeping.</em></h1>
          <p>Upload a photograph, add a few details, and your collection will be ready whenever you are.</p>
        </section>

        {identityError && <p className="notice notice-error" role="alert">Could not load your account details: {identityError}</p>}

        <div className="workspace-grid">
          <section className="panel upload-panel" aria-labelledby="upload-heading">
            <div className="panel-heading">
              <div>
                <span className="section-index">01 / ADD TO YOUR COLLECTION</span>
                <h2 id="upload-heading">Upload a photo</h2>
              </div>
              <span className="panel-icon" aria-hidden="true">↥</span>
            </div>
            <div className="upload-fields">
              <label className="field-label" htmlFor="photo-title">Title <span>OPTIONAL</span></label>
              <input
                id="photo-title"
                className="text-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Give this moment a name"
                disabled={uploading}
              />
              <label className="field-label" htmlFor="photo-description">Description <span>OPTIONAL</span></label>
              <textarea
                id="photo-description"
                className="text-input description-input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A little context, if you like"
                rows={3}
                disabled={uploading}
              />
            </div>
            <div className="uploader-wrap">
              <FileUploader
                path="photos/"
                acceptedFileTypes={['image/*']}
                maxFileCount={1}
                onUploadStart={() => {
                  setUploading(true)
                  setUploadError('')
                }}
                onUploadSuccess={({ key }) => {
                  void createPhotoRecord(key).catch((error: unknown) => {
                    setUploadError(`Photo uploaded, but its record could not be saved: ${messageFromError(error)}`)
                    setUploading(false)
                  })
                }}
                onUploadError={(error) => {
                  setUploadError(error)
                  setUploading(false)
                }}
              />
            </div>
            {uploading && <p className="inline-status" role="status">Saving your photo…</p>}
            {uploadError && <p className="notice notice-error" role="alert">{uploadError}</p>}
            <p className="helper-text">Images only · Stored securely in your private collection</p>
          </section>

          <section className="panel api-panel" aria-labelledby="api-heading">
            <div className="panel-heading">
              <div>
                <span className="section-index">02 / CONNECTED SERVICES</span>
                <h2 id="api-heading">REST API demo</h2>
              </div>
              <span className="panel-icon panel-icon-api" aria-hidden="true">↗</span>
            </div>
            <p className="panel-description">Try the public route or make an authenticated request with your ID token.</p>
            <div className="api-actions">
              <button className="button button-outline" onClick={() => void runRestRequest('/hello')} disabled={publicResult.loading}>
                <span className="method-tag">GET</span> /hello <span className="route-access">PUBLIC</span>
              </button>
              <button className="button button-outline" onClick={() => void runRestRequest('/me')} disabled={protectedResult.loading}>
                <span className="method-tag">GET</span> /me <span className="route-access">PROTECTED</span>
              </button>
            </div>
            <RestResponse label="Public response" result={publicResult} />
            <RestResponse label="Protected response" result={protectedResult} />
          </section>
        </div>

        <section className="gallery-section" aria-labelledby="gallery-heading">
          <div className="gallery-heading">
            <div>
              <span className="section-index">03 / YOUR COLLECTION</span>
              <h2 id="gallery-heading">The gallery</h2>
            </div>
            {!photosLoading && <span className="photo-count">{photos.length.toString().padStart(2, '0')} PHOTOS</span>}
          </div>

          {photosError && <p className="notice notice-error" role="alert">Could not load your gallery: {photosError}</p>}
          {deleteError && <p className="notice notice-error" role="alert">{deleteError}</p>}
          {photosLoading ? (
            <div className="gallery-message" role="status"><span className="spinner" /> Loading your collection…</div>
          ) : photos.length === 0 ? (
            <div className="empty-gallery">
              <span className="empty-icon" aria-hidden="true">▧</span>
              <h3>Your gallery is waiting.</h3>
              <p>Upload your first image to start building your collection.</p>
            </div>
          ) : (
            <div className="photo-grid">
              {photos.map((photo) => (
                <article className="photo-card" key={photo.id}>
                  <div className="photo-image">
                    <StorageImage path={photo.s3Key} alt={photo.title} />
                  </div>
                  <div className="photo-info">
                    <div className="photo-title-row">
                      <h3>{photo.title}</h3>
                      {isOwner(photo) && (
                        <button
                          className="delete-button"
                          aria-label={`Delete ${photo.title}`}
                          title="Delete photo"
                          onClick={() => void deletePhoto(photo)}
                          disabled={deletingId === photo.id}
                        >
                          {deletingId === photo.id ? '…' : '×'}
                        </button>
                      )}
                    </div>
                    <p>{photo.description || 'A moment, saved.'}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>FRAME <span className="brand-period">·</span> A LITTLE SPACE FOR WHAT MATTERS</span>
        <span>PRIVATE BY DESIGN</span>
      </footer>
    </div>
  )
}

function RestResponse({ label, result }: { label: string; result: RestResult }) {
  if (!result.loading && !result.value && !result.error) return null

  return (
    <div className="response-block">
      <span className="response-label">{label}</span>
      {result.loading ? (
        <p className="inline-status" role="status">Request in progress…</p>
      ) : result.error ? (
        <p className="response-error" role="alert">{result.error}</p>
      ) : (
        <pre className="response-json">{result.value}</pre>
      )}
    </div>
  )
}

function App() {
  return (
    <Authenticator socialProviders={['google']}>
      <Dashboard />
    </Authenticator>
  )
}

export default App
