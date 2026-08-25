import { useId, useState } from 'react'
import { Flag, Layers3, Route } from 'lucide-react'
import { formatNumber } from '../../utils/format'
import { getRankInfo } from '../../utils/ranks'
import RankPath from './RankPath'
import styles from './ProfileProgress.module.css'

export default function ProfileProgress({ totalPoints, mainCount, communityCount }) {
  const titleId = useId()
  const [showPath, setShowPath] = useState(false)
  const safePoints = Math.max(0, Number(totalPoints) || 0)
  const { rank, nextRank, tier, totalTiers, progressPct, pointsToNext } = getRankInfo(safePoints)
  const RankIcon = rank.icon
  const completionTotal = mainCount + communityCount
  const mainShare = completionTotal > 0 ? (mainCount / completionTotal) * 100 : 0
  const communityShare = completionTotal > 0 ? 100 - mainShare : 0

  return (
    <section
      className={styles.panel}
      aria-labelledby={titleId}
      style={{ '--from': rank.from, '--to': rank.to, '--glow': rank.glow }}
    >
      <div className={styles.heading}>
        <div className={styles.rankIdentity}>
          <span className={styles.emblemGlow} aria-hidden="true">
            <span className={styles.emblem}>
              <RankIcon size={36} strokeWidth={2.1} />
            </span>
          </span>
          <div>
            <span className={styles.eyebrow}>Player progress · Tier {tier} of {totalTiers}</span>
            <h2 id={titleId} className={styles.rankName}>{rank.name}</h2>
            <strong className={styles.points}>{formatNumber(safePoints)} pts</strong>
          </div>
        </div>
      </div>

      <div className={styles.milestoneRow}>
        {nextRank ? (
          <span>
            Next: <strong className={styles.nextName}>{nextRank.name}</strong>
          </span>
        ) : (
          <span>Final rank reached</span>
        )}
        {nextRank && (
          <span>
            <strong>{formatNumber(pointsToNext)}</strong> pts to go
          </span>
        )}
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPct)}
        aria-label={`${Math.round(progressPct)}% progress to ${nextRank ? nextRank.name : 'max rank'}`}
      >
        <span style={{ width: `${progressPct}%` }} />
      </div>

      <div className={styles.splitHeading}>
        <span><Flag size={14} aria-hidden="true" /> Main clears: {mainCount}</span>
        <span>Community clears: {communityCount} <Layers3 size={14} aria-hidden="true" /></span>
      </div>
      <div className={styles.splitTrack} aria-label={`${mainCount} main and ${communityCount} community completions`}>
        <span className={styles.mainSplit} style={{ width: `${mainShare}%` }} />
        <span className={styles.communitySplit} style={{ width: `${communityShare}%` }} />
      </div>

      <button
        type="button"
        className={styles.viewPathBtn}
        onClick={() => setShowPath(v => !v)}
        aria-expanded={showPath}
      >
        <Route size={15} aria-hidden="true" />
        {showPath ? 'Hide path' : 'View path'}
      </button>

      {showPath && <RankPath totalPoints={safePoints} />}
    </section>
  )
}
