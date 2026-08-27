import { useEffect, useState } from 'react'
import { collection, documentId, getDocs, query, where } from 'firebase/firestore'
import { ExternalLink, History, ListCheck, LockKeyhole, RefreshCw } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { db } from '../../services/firebase'
import { getCollection } from '../../services/firestore'
import { formatDateRelative, getDisplayName } from '../../utils/format'
import styles from './Admin.module.css'

const HISTORY_LIMIT = 50
const IN_QUERY_LIMIT = 30
const LIST_TABS = [
  { id: 'main', label: 'Main List' },
  { id: 'community', label: 'Community List' },
]

function timestampMillis(value) {
  if (value?.toMillis) return value.toMillis()
  if (!value) return 0
  const millis = new Date(value).getTime()
  return Number.isNaN(millis) ? 0 : millis
}

function levelNameFor(submission, levelsById) {
  const snapshotName = submission.demonName || submission.manualLevelName || submission.levelName
  return snapshotName || levelsById.get(submission.levelId)?.name || 'Unknown level'
}

async function getDocumentsById(collectionName, ids) {
  const documents = new Map()

  for (let index = 0; index < ids.length; index += IN_QUERY_LIMIT) {
    const idChunk = ids.slice(index, index + IN_QUERY_LIMIT)
    const snapshot = await getDocs(query(
      collection(db, collectionName),
      where(documentId(), 'in', idChunk),
    ))
    snapshot.forEach(result => documents.set(result.id, { id: result.id, ...result.data() }))
  }

  return documents
}

export default function ApprovalHistory() {
  const [tab, setTab] = useState('main')
  const [history, setHistory] = useState([])
  const [counts, setCounts] = useState({ main: 0, community: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      setLoading(true)
      setError('')

      try {
        const submissions = await getCollection('submissions', [where('status', '==', 'approved')])

        if (cancelled) return

        const accepted = submissions
          .filter(submission => (
            (submission.requestType || 'completion') === 'completion'
          ))
          .sort((a, b) => (
            timestampMillis(b.reviewedAt || b.updatedAt)
            - timestampMillis(a.reviewedAt || a.updatedAt)
          ))

        const nextCounts = {
          main: accepted.filter(submission => (submission.levelType || 'main') === 'main').length,
          community: accepted.filter(submission => submission.levelType === 'community').length,
        }

        const recent = LIST_TABS.flatMap(({ id }) => (
          accepted
            .filter(submission => (submission.levelType || 'main') === id)
            .slice(0, HISTORY_LIMIT)
        ))

        const levelIds = Array.from(new Set(recent.map(item => item.levelId).filter(Boolean)))
        const userIds = Array.from(new Set(recent.flatMap(item => (
          [item.userId, item.reviewedBy].filter(Boolean)
        ))))
        const [levelsById, usersById] = await Promise.all([
          getDocumentsById('levels', levelIds),
          getDocumentsById('users', userIds),
        ])

        if (cancelled) return

        setCounts(nextCounts)
        setHistory(recent.map(submission => ({
          ...submission,
          levelName: levelNameFor(submission, levelsById),
          levelType: submission.levelType || 'main',
          submitterName: getDisplayName(usersById.get(submission.userId)),
          reviewerName: submission.reviewerName
            || (usersById.has(submission.reviewedBy)
              ? getDisplayName(usersById.get(submission.reviewedBy))
              : 'Unknown admin'),
        })))
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError)
          setError('The approval history could not be loaded. Check the Firebase rules and try again.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadHistory()
    return () => { cancelled = true }
  }, [reloadKey])

  const visibleHistory = history.filter(item => item.levelType === tab)

  return (
    <PageShell
      title="Completion Approval History"
      subtitle="Admin-only audit of accepted records and the staff member who approved them"
    >
      <Card padding="md" className={styles.historyIntro}>
        <div className={styles.historyIntroCopy}>
          <span className={styles.historyIcon} aria-hidden="true">
            <LockKeyhole size={20} />
          </span>
          <div>
            <h2 className={styles.historyHeading}>Private moderation record</h2>
            <p className={styles.historyDescription}>
              Players cannot see this page or the reviewer attached to an approval.
            </p>
          </div>
        </div>
        <div className={styles.historyActions}>
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={() => setReloadKey(value => value + 1)}
          >
            Refresh
          </Button>
          <Button to="/admin/submissions" variant="secondary" size="sm" icon={ListCheck}>
            Review submissions
          </Button>
        </div>
      </Card>

      <div className={styles.tabs} role="group" aria-label="Approval history list">
        {LIST_TABS.map(list => (
          <button
            key={list.id}
            type="button"
            aria-pressed={tab === list.id}
            className={`${styles.tab} ${tab === list.id ? styles.tabActive : ''}`}
            onClick={() => setTab(list.id)}
          >
            {list.label}
            <span className={styles.tabCount}>{counts[list.id]}</span>
          </button>
        ))}
      </div>

      {loading && history.length === 0 ? (
        <div className={styles.loading} role="status" aria-label="Loading approval history">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card padding="lg" className={styles.historyEmptyCard}>
          <History size={28} aria-hidden="true" />
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey(value => value + 1)}>
            Try again
          </Button>
        </Card>
      ) : (
        <Card padding="sm" className={styles.historyCard}>
          {visibleHistory.length === 0 ? (
            <p className={styles.historyEmpty}>No accepted completions have been recorded for this list yet.</p>
          ) : (
            <ul className={styles.historyList}>
              {visibleHistory.map(item => {
                const reviewedAt = item.reviewedAt || item.updatedAt
                const reviewedDate = reviewedAt?.toDate?.() || (reviewedAt ? new Date(reviewedAt) : null)
                const dateTime = reviewedDate && !Number.isNaN(reviewedDate.getTime())
                  ? reviewedDate.toISOString()
                  : undefined

                return (
                  <li key={item.id} className={styles.historyRow}>
                    <div className={styles.historyCompletion}>
                      <span className={styles.historyLevel}>{item.levelName}</span>
                      <span className={styles.historyPlayer}>Completed by {item.submitterName}</span>
                    </div>
                    <Badge variant={item.levelType === 'main' ? 'green' : 'blue'} size="sm">
                      {item.levelType}
                    </Badge>
                    <div className={styles.historyReview}>
                      <span>Accepted by <strong>{item.reviewerName}</strong></span>
                      <time dateTime={dateTime} title={reviewedDate?.toLocaleString()}>
                        {reviewedAt ? (formatDateRelative(reviewedAt) || 'Date unavailable') : 'Date unavailable'}
                      </time>
                    </div>
                    {item.videoURL ? (
                      <Button
                        href={item.videoURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="ghost"
                        size="sm"
                        icon={ExternalLink}
                        aria-label={`Watch ${item.submitterName}'s proof for ${item.levelName}`}
                      >
                        Proof
                      </Button>
                    ) : (
                      <span className={styles.historyNoProof}>No proof link</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {counts[tab] > visibleHistory.length && (
            <p className={styles.historyLimit}>Showing the {HISTORY_LIMIT} most recent approvals.</p>
          )}
        </Card>
      )}
    </PageShell>
  )
}
