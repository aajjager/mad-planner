import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
interface RatingStarsProps { value: number | null; average?: number | null; count?: number; onChange?: (value: number | null) => void; label: string }

export function RatingStars({ value, average, count = 0, onChange, label }: RatingStarsProps) {
  const { account } = useAuth(); const t = translator(account?.locale)
  return <div className="rating-block"><div className="rating-stars" role={onChange ? 'radiogroup' : undefined} aria-label={label}>{[1, 2, 3, 4, 5].map((star) => onChange ? <button type="button" className={star <= (value || 0) ? 'is-selected' : ''} aria-label={`${star} ${t('starsLabel')}`} aria-pressed={value === star} onClick={() => onChange(value === star ? null : star)} key={star}>★</button> : <span className={star <= Math.round(average || 0) ? 'is-selected' : ''} key={star}>★</span>)}</div>{average != null && <small>{average.toFixed(1)} · {count} {count === 1 ? t('ratingLabel') : t('ratingsLabel')}</small>}</div>
}
