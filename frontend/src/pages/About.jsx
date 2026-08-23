import { useLanguage } from '../lib/LanguageContext'
import { Card } from '../components/ui'
import Icon from '../components/Icon'

const SUPPORT_EMAIL = 'knee.reply@gmail.com'

export default function About() {
  const { t } = useLanguage()

  const steps = [t('aboutStep1'), t('aboutStep2'), t('aboutStep3'), t('aboutStep4'), t('aboutStep5')]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">{t('navAbout')}</h2>
        <p className="text-[13px] text-muted mt-1 font-display max-w-2xl">{t('aboutTagline')}</p>
      </div>

      <Card eyebrow="Platform" title={t('aboutWhatTitle')} icon="activity" tone="green">
        <p className="text-[13px] text-navy font-display leading-relaxed">{t('aboutWhatBody')}</p>
      </Card>

      <Card eyebrow="Pipeline" title={t('aboutHowTitle')} icon="layers" tone="amber">
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="w-7 h-7 rounded-[8px] bg-page text-navy flex items-center justify-center
                           text-[12px] font-display font-bold shrink-0"
                style={{ border: '2px solid #2D2016' }}
              >
                {i + 1}
              </span>
              <p className="text-[13px] text-navy font-display leading-relaxed pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card eyebrow="Support" title={t('aboutContactTitle')} icon="globe" tone="blue">
        <p className="text-[13px] text-muted font-display leading-relaxed mb-5">{t('aboutContactBody')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-[12px] bg-page p-4" style={{ border: '2px solid #2D2016' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <Icon name="mail" size={16} className="text-accent" />
              <span className="text-[13px] font-display font-bold text-navy">{t('aboutEmailLabel')}</span>
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[14px] font-display font-semibold text-accent hover:text-navy transition-colors duration-150 break-all"
            >
              {SUPPORT_EMAIL}
            </a>
            <p className="mt-2 text-[11px] text-muted font-display leading-relaxed">{t('aboutEmailNote')}</p>
          </div>

          <div className="rounded-[12px] bg-page p-4" style={{ border: '2px solid #2D2016' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <Icon name="chat" size={15} className="text-accent" />
              <span className="text-[13px] font-display font-bold text-navy">{t('aboutChatLabel')}</span>
            </div>
            <p className="text-[12px] text-muted font-display leading-relaxed">{t('aboutChatNote')}</p>
          </div>
        </div>
      </Card>

      <Card eyebrow="Clinical Use" title={t('aboutDisclaimerTitle')} icon="shield" tone="red">
        <p className="text-[13px] text-muted font-display leading-relaxed">{t('disclaimer')}</p>
      </Card>
    </div>
  )
}
