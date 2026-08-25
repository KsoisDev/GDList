import { useRef, useEffect } from 'react'
import { RANKS } from '../../utils/ranks'
import { formatNumber } from '../../utils/format'
import styles from './RankPath.module.css'

export default function RankPath({ totalPoints }) {
  const points = Math.max(0, Number(totalPoints) || 0)
  const currentIdx = (() => {
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (points >= RANKS[i].min) return i
    }
    return 0
  })()

  const scrollRef = useRef(null)

  useEffect(() => {
    if (!scrollRef.current) return
    const node = scrollRef.current.querySelector(`[data-rank-index="${currentIdx}"]`)
    if (node) {
      node.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }
  }, [currentIdx])

  return (
    <div className={styles.wrapper} ref={scrollRef}>
      <div className={styles.path}>
        {RANKS.map((rank, i) => {
          const RankIcon = rank.icon
          const isCurrent = i === currentIdx
          const isPast = i < currentIdx
          const isFuture = i > currentIdx
          const nextMin = RANKS[i + 1]?.min || null
          const span = nextMin !== null ? nextMin - rank.min : 0
          let pct = 0
          if (isPast) pct = 100
          else if (isCurrent && span > 0) pct = Math.min(100, ((points - rank.min) / span) * 100)

          return (
            <div key={rank.id} className={styles.segment}>
              <div
                className={`${styles.node} ${isCurrent ? styles.nodeCurrent : ''} ${isPast ? styles.nodePast : ''} ${isFuture ? styles.nodeFuture : ''}`}
                data-rank-index={i}
                style={{ '--from': rank.from, '--to': rank.to, '--glow': rank.glow }}
              >
                <div className={styles.nodeIcon}>
                  <RankIcon size={isCurrent ? 22 : 18} strokeWidth={2} />
                </div>
                <span className={styles.nodeName}>{rank.name}</span>
                <span className={styles.nodePoints}>{formatNumber(rank.min)} pts</span>
              </div>

              {i < RANKS.length - 1 && (
                <div className={styles.connectorWrap}>
                  <div className={`${styles.connector} ${isPast ? styles.connectorFull : ''}`}>
                    {isCurrent && (
                      <span className={styles.connectorFill} style={{ width: `${pct}%` }} />
                    )}
                  </div>
                  {nextMin !== null && (
                    <span className={styles.gapLabel}>
                      +{formatNumber(nextMin - rank.min)}
                    </span>
                  )}
                  {isCurrent && span > 0 && (
                    <span className={styles.gapPct}>{Math.round(pct)}%</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
