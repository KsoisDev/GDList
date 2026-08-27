import { useEffect, useMemo, useState } from 'react'
import { collection, documentId, getDocs, query, where } from 'firebase/firestore'
import { ExternalLink, History, ListCheck, LockKeyhole, RefreshCw } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import { db } from '../../services/firebase'
import { getCollection } from '../../services/firestore'
import { formatDateRelative, getDisplayName } from '../../utils/format'
import styles from './Admin.module.css'

const IN_QUERY_LIMIT = 30
const LIST_TABS = [
  { id: 'all', label: 'All Records' },
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
  const chunks = []

  for (let index = 0; index < ids.length; index += IN_QUERY_LIMIT) {
    chunks.push(ids.slice(index, index + IN_QUERY_LIMIT))
  }

  const snapshots = await Promise.all(chunks.map(idChunk => getDocs(query(
    collection(db, collectionName),
    where(documentId(), 'in', idChunk),
  ))))

  snapshots.forEach(snapshot => {
    snapshot.forEach(result => documents.set(result.id, { id: result.id, ...result.data() }))
  })

  return documents
}

export default function ApprovalHistory() {
  const [tab, setTab] = useState('all')
  const [history, setHistory] = useState([])
  const [counts, setCounts] = useState({ all: 0, main: 0, community: 0 })
  const [reviewerFilter, setReviewerFilter] = useState('all')
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
          all: accepted.length,
          main: accepted.filter(submission => (submission.levelType || 'main') === 'main').length,
          community: accepted.filter(submission => submission.levelType === 'community').length,
        }

        const levelIds = Array.from(new Set(accepted.map(item => item.levelId).filter(Boolean)))
        const userIds = Array.from(new Set(accepted.flatMap(item => (
          [item.userId, item.reviewedBy].filter(Boolean)
        ))))
        const [levelsById, usersById] = await Promise.all([
          getDocumentsById('levels', levelIds),
          getDocumentsById('users', userIds),
        ])

        if (cancelled) return

        setCounts(nextCounts)
        setHistory(accepted.map(submission => {
          const reviewerName = submission.reviewerName
            || (usersById.has(submission.reviewedBy)
              ? getDisplayName(usersById.get(submission.reviewedBy))
              : 'Unknown admin')

          return {
            ...submission,
            levelName: levelNameFor(submission, levelsById),
            levelType: submission.levelType || 'main',
            submitterName: getDisplayName(usersById.get(submission.userId)),
            reviewerName,
            reviewerKey: submission.reviewedBy || `name:${reviewerName.trim().toLowerCase()}`,
          }
        }))
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

  const reviewerOptions = useMemo(() => {
    const reviewers = new Map()

    history.forEach(item => {
      const existing = reviewers.get(item.reviewerKey)
      reviewers.set(item.reviewerKey, {
        value: item.reviewerKey,
        name: existing?.name || item.reviewerName,
        count: (existing?.count || 0) + 1,
      })
    })

    return Array.from(reviewers.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map(reviewer => ({
        value: reviewer.value,
        label: `${reviewer.name} (${reviewer.count})`,
      }))
  }, [history])

  const visibleHistory = useMemo(() => history.filter(item => (
    (tab === 'all' || item.levelType === tab)
    && (reviewerFilter === 'all' || item.reviewerKey === reviewerFilter)
  )), [history, reviewerFilter, tab])

  const selectedReviewerName = reviewerFilter === 'all'
    ? 'All reviewers'
    : (reviewerOptions.find(option => option.value === reviewerFilter)?.label || 'Selected reviewer')
  const historyScopeLabel = tab === 'all' ? 'across all lists' : 'on this list'

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

      <Card padding="sm" className={styles.historyFilters}>
        <Select
          id="approval-reviewer-filter"
          label="Accepted by"
          value={reviewerFilter}
          onChange={event => {
            setReviewerFilter(event.target.value)
            if (event.target.value !== 'all') setTab('all')
          }}
          options={[
            { value: 'all', label: `All reviewers (${history.length})` },
            ...reviewerOptions,
          ]}
        />
        <p className={styles.historyFilterSummary} aria-live="polite">
          <strong>{selectedReviewerName}</strong>
          <span>
            {visibleHistory.length} accepted {visibleHistory.length === 1 ? 'record' : 'records'} {historyScopeLabel}
          </span>
        </p>
      </Card>

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
            <p className={styles.historyEmpty}>
              {reviewerFilter === 'all'
                ? (tab === 'all'
                  ? 'No accepted completions have been recorded yet.'
                  : 'No accepted completions have been recorded for this list yet.')
                : `This reviewer has not accepted any completions ${historyScopeLabel}.`}
            </p>
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
                      <span>
                        Accepted by{' '}
                        <button
                          type="button"
                          className={styles.historyReviewer}
                          onClick={() => {
                            setReviewerFilter(item.reviewerKey)
                            setTab('all')
                          }}
                          aria-label={`Show every record accepted by ${item.reviewerName}`}
                        >
                          {item.reviewerName}
                        </button>
                      </span>
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
        </Card>
      )}
    </PageShell>
  )
}
