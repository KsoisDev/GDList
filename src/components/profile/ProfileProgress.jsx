import { useId } from 'react'
import { Flag, Layers3, TrendingUp } from 'lucide-react'
import { formatNumber } from '../../utils/format'
import styles from './ProfileProgress.module.css'

export default function ProfileProgress({ totalPoints, mainCount, communityCount }) {
  const titleId = useId()
  const safePoints = Math.max(0, Number(totalPoints) || 0)
  const milestoneSize = 500
  const milestoneFloor = Math.floor(safePoints / milestoneSize) * milestoneSize
  const nextMilestone = milestoneFloor + milestoneSize
  const milestoneProgress = Math.min(100, ((safePoints - milestoneFloor) / milestoneSize) * 100)
  const pointsRemaining = Math.max(0, nextMilestone - safePoints)
  const completionTotal = mainCount + communityCount
  const mainShare = completionTotal > 0 ? (mainCount / completionTotal) * 100 : 0
  const communityShare = completionTotal > 0 ? 100 - mainShare : 0

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <div>
          <span>PLAYER PROGRESS</span>
          <h2 id={titleId}>Next milestone</h2>
        </div>
        <TrendingUp size={20} aria-hidden="true" />
      </div>

      <div className={styles.milestoneRow}>
        <strong>{formatNumber(safePoints)} pts</strong>
        <span>{formatNumber(pointsRemaining)} points to {formatNumber(nextMilestone)}</span>
      </div>
      <div className={styles.progressTrack} aria-label={`${Math.round(milestoneProgress)}% progress to ${nextMilestone} points`}>
        <span style={{ width: `${milestoneProgress}%` }} />
      </div>

      <div className={styles.splitHeading}>
        <span><Flag size={14} aria-hidden="true" /> Main clears: {mainCount}</span>
        <span>Community clears: {communityCount} <Layers3 size={14} aria-hidden="true" /></span>
      </div>
      <div className={styles.splitTrack} aria-label={`${mainCount} main and ${communityCount} community completions`}>
        <span className={styles.mainSplit} style={{ width: `${mainShare}%` }} />
        <span className={styles.communitySplit} style={{ width: `${communityShare}%` }} />
      </div>
    </section>
  )
}
