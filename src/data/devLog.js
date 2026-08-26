export const DEV_LOG_POSTS = [
  {
    id: 'major-website-revamp',
    date: '2026-08-25',
    badgeKey: 'devLog.post.revamp.badge',
    titleKey: 'devLog.post.revamp.title',
    summaryKey: 'devLog.post.revamp.summary',
    authors: ['ntyu2', 'Ksois'],
    sections: [
      {
        id: 'added',
        titleKey: 'devLog.added',
        items: [
          'devLog.post.revamp.addedDesign',
          'devLog.post.revamp.addedRankings',
          'devLog.post.revamp.addedLanguages',
          'devLog.post.revamp.addedAuth',
          'devLog.post.revamp.addedRoles',
        ],
      },
      {
        id: 'improved',
        titleKey: 'devLog.improved',
        items: [
          'devLog.post.revamp.improvedMobile',
          'devLog.post.revamp.improvedSpeed',
          'devLog.post.revamp.improvedAccess',
        ],
      },
      {
        id: 'fixed',
        titleKey: 'devLog.fixed',
        items: [
          'devLog.post.revamp.fixedPages',
          'devLog.post.revamp.fixedStats',
          'devLog.post.revamp.fixedReview',
        ],
      },
      {
        id: 'working',
        titleKey: 'devLog.working',
        items: [
          'devLog.post.revamp.workingBackend',
          'devLog.post.revamp.workingFeedback',
        ],
      },
      {
        id: 'next',
        titleKey: 'devLog.next',
        items: [
          'devLog.post.revamp.nextAchievements',
          'devLog.post.revamp.nextRandom',
          'devLog.post.revamp.nextStats',
        ],
      },
    ],
  },
]

export const LATEST_DEV_LOG = DEV_LOG_POSTS[0]

const DATE_LOCALES = {
  en: 'en-GB',
  fr: 'fr-FR',
  ru: 'ru-RU',
  es: 'es-ES',
}

export function formatDevLogDate(date, language, options = {}) {
  const parsed = new Date(`${date}T12:00:00Z`)
  return new Intl.DateTimeFormat(DATE_LOCALES[language] || DATE_LOCALES.en, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  }).format(parsed)
}
