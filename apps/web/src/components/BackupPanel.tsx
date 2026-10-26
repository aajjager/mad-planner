import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { useState } from 'react'
import { downloadDatabaseBackup, downloadMediaBackup, validateDatabaseBackup } from '../api/auth'

export function BackupPanel({ reportError }: { reportError: (message: string) => void }) {
  const { account } = useAuth(); const t = translator(account?.locale)
  const [busy, setBusy] = useState(''); const [result, setResult] = useState<{ tables: number; users: number; recipes: number; migration: string } | null>(null)
  async function run(name: string, action: () => Promise<void>) { setBusy(name); reportError(''); try { await action() } catch (reason) { reportError(reason instanceof Error ? reason.message : t('backupFailed')) } finally { setBusy('') } }
  return <section className="family-panel"><h2>{t('backupsTitle')}</h2><p>{t('backupsHelp')}</p><div className="heading-actions"><button className="button button--primary" disabled={Boolean(busy)} onClick={() => void run('database', downloadDatabaseBackup)}>{busy === 'database' ? t('creatingBackup') : t('downloadDatabase')}</button><button className="button" disabled={Boolean(busy)} onClick={() => void run('media', downloadMediaBackup)}>{busy === 'media' ? t('creatingBackup') : t('downloadPhotos')}</button></div><label className="field"><span>{t('verifyBackup')}</span><input type="file" accept=".dump,.dmp,application/octet-stream" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setBusy('validate'); setResult(null); reportError(''); validateDatabaseBackup(file).then(setResult).catch((reason) => reportError(reason instanceof Error ? reason.message : t('backupVerifyFailed'))).finally(() => setBusy('')) }} /><small>{busy === 'validate' ? t('backupRestoring') : t('backupSafe')}</small></label>{result && <div className="notice notice--success"><strong>{t('backupVerified')}</strong><p>{result.tables} {t('tablesLabel')} · {result.users} {t('usersLabel')} · {result.recipes} {t('recipePlural')} · {t('migrationLabel')} {result.migration}</p></div>}</section>
}
