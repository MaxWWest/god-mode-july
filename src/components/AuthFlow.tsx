import type { User } from '@supabase/supabase-js'
import type { DataStatus } from '../types'
import { TextField } from '../ui'

export type AuthFlowMode = 'signIn' | 'register' | 'checkEmail' | 'setPassword' | 'account'
export type AuthEmailPurpose = 'signup' | 'reset'

type AuthFlowProps = {
  mode: AuthFlowMode
  emailPurpose: AuthEmailPurpose
  user: User | null
  email: string
  password: string
  passwordConfirmation: string
  status: DataStatus
  busy: boolean
  online: boolean
  passwordSetupRequired: boolean
  onModeChange: (mode: AuthFlowMode) => void
  onEmailChange: (email: string) => void
  onPasswordChange: (password: string) => void
  onPasswordConfirmationChange: (password: string) => void
  onSignIn: () => void
  onSendSignupLink: () => void
  onSendPasswordReset: () => void
  onSetPassword: () => void
  onSignOut: () => void
  onContinueLocal: () => void
  onClose: () => void
}

function AccountSteps({ active }: { active: 1 | 2 | 3 }) {
  return (
    <ol className="auth-stepper" aria-label={`Account setup step ${active} of 3`}>
      <li className={active >= 1 ? 'active' : ''}><b>1</b><span>Email</span></li>
      <li className={active >= 2 ? 'active' : ''}><b>2</b><span>Verify</span></li>
      <li className={active >= 3 ? 'active' : ''}><b>3</b><span>Password</span></li>
    </ol>
  )
}

export default function AuthFlow({
  mode,
  emailPurpose,
  user,
  email,
  password,
  passwordConfirmation,
  status,
  busy,
  online,
  passwordSetupRequired,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmationChange,
  onSignIn,
  onSendSignupLink,
  onSendPasswordReset,
  onSetPassword,
  onSignOut,
  onContinueLocal,
  onClose,
}: AuthFlowProps) {
  const unavailable = busy || !online

  return (
    <div className="auth-gateway" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <section className="auth-gateway-panel">
        <header className="auth-gateway-header">
          <div className="auth-brand-lockup">
            <span className="auth-brand-mark" aria-hidden="true">GM</span>
            <div>
              <p className="eyebrow">God Mode account</p>
              <strong>Track here. Continue anywhere.</strong>
            </div>
          </div>
          {!passwordSetupRequired && (
            <button className="auth-close-button" type="button" onClick={onClose} aria-label="Close account window">x</button>
          )}
        </header>

        {mode === 'signIn' && (
          <div className="auth-screen">
            <div className="auth-screen-heading">
              <p className="eyebrow">Returning user</p>
              <h2 id="auth-title">Welcome back.</h2>
              <p>Use the email and password you created after verifying your signup email.</p>
            </div>
            <div className="auth-mode-switch" role="tablist" aria-label="Account access">
              <button className="active" type="button" role="tab" aria-selected="true">Sign In</button>
              <button type="button" role="tab" aria-selected="false" onClick={() => onModeChange('register')}>Create Account</button>
            </div>
            <form className="auth-fields" onSubmit={(event) => { event.preventDefault(); onSignIn() }}>
              <TextField label="Email" type="email" value={email} onChange={onEmailChange} />
              <TextField label="Password" type="password" value={password} onChange={onPasswordChange} />
              <button className="primary-button" type="submit" disabled={unavailable}>Sign In</button>
            </form>
            <button className="auth-text-button" type="button" onClick={onSendPasswordReset} disabled={unavailable}>Forgot your password?</button>
            <p className="auth-local-copy">Just tracking on this device for now?</p>
            <button className="ghost-button auth-wide-button" type="button" onClick={onContinueLocal}>Continue without an account</button>
          </div>
        )}

        {mode === 'register' && (
          <div className="auth-screen">
            <AccountSteps active={1} />
            <div className="auth-screen-heading">
              <p className="eyebrow">New user</p>
              <h2 id="auth-title">Create your account.</h2>
              <p>Start with your email. We will send one secure signup link, then this app will ask you to create and confirm a password.</p>
            </div>
            <div className="auth-mode-switch" role="tablist" aria-label="Account access">
              <button type="button" role="tab" aria-selected="false" onClick={() => onModeChange('signIn')}>Sign In</button>
              <button className="active" type="button" role="tab" aria-selected="true">Create Account</button>
            </div>
            <form className="auth-fields" onSubmit={(event) => { event.preventDefault(); onSendSignupLink() }}>
              <TextField label="Email" type="email" value={email} onChange={onEmailChange} />
              <button className="primary-button" type="submit" disabled={unavailable}>Send Signup Link</button>
            </form>
            <div className="auth-callout">
              <strong>No password yet.</strong>
              <span>You will make it after opening the email link. Check Spam or Junk if the message is not in your inbox.</span>
            </div>
            <button className="ghost-button auth-wide-button" type="button" onClick={onContinueLocal}>Continue without an account</button>
          </div>
        )}

        {mode === 'checkEmail' && (
          <div className="auth-screen">
            <AccountSteps active={2} />
            <div className="auth-screen-heading">
              <p className="eyebrow">Email sent</p>
              <h2 id="auth-title">Check your email.</h2>
              <p>We sent a {emailPurpose === 'signup' ? 'signup' : 'password reset'} link to <strong>{email}</strong>.</p>
            </div>
            <ol className="auth-instructions">
              <li><b>1</b><span>Open the email from God Mode July or Supabase.</span></li>
              <li><b>2</b><span>Tap the link. It will bring you back to this app.</span></li>
              <li><b>3</b><span>Create and confirm your password here.</span></li>
            </ol>
            <div className="auth-callout is-warning">
              <strong>Nothing yet?</strong>
              <span>Check Spam or Junk and allow a few minutes for delivery before resending.</span>
            </div>
            <button className="secondary-button auth-wide-button" type="button" onClick={emailPurpose === 'signup' ? onSendSignupLink : onSendPasswordReset} disabled={unavailable}>Resend Email</button>
            <button className="auth-text-button" type="button" onClick={() => onModeChange('signIn')}>Back to Sign In</button>
          </div>
        )}

        {mode === 'setPassword' && (
          <div className="auth-screen">
            <AccountSteps active={3} />
            <div className="auth-screen-heading">
              <p className="eyebrow">{passwordSetupRequired ? 'Final account step' : 'Account security'}</p>
              <h2 id="auth-title">{passwordSetupRequired ? 'Create your password.' : 'Change your password.'}</h2>
              <p>Enter it twice so we know it is correct. {passwordSetupRequired ? 'From now on, this is how you will sign in.' : 'Your new password will be used the next time you sign in.'}</p>
            </div>
            <form className="auth-fields" onSubmit={(event) => { event.preventDefault(); onSetPassword() }}>
              <TextField label="New password" type="password" value={password} onChange={onPasswordChange} />
              <TextField label="Confirm password" type="password" value={passwordConfirmation} onChange={onPasswordConfirmationChange} />
              <small className="auth-password-hint">Use at least 8 characters.</small>
              <button className="primary-button" type="submit" disabled={unavailable}>{passwordSetupRequired ? 'Create Password' : 'Save New Password'}</button>
            </form>
          </div>
        )}

        {mode === 'account' && (
          <div className="auth-screen">
            <div className="auth-screen-heading">
              <p className="eyebrow">Account ready</p>
              <h2 id="auth-title">You are signed in.</h2>
              <p>Your tracker can sync across devices and connect with friends.</p>
            </div>
            <div className="auth-account-card">
              <span>Email</span>
              <strong>{user?.email}</strong>
            </div>
            <button className="secondary-button auth-wide-button" type="button" onClick={() => onModeChange('setPassword')}>Change Password</button>
            <button className="primary-button" type="button" onClick={onClose}>Done</button>
            <button className="auth-text-button is-danger" type="button" onClick={onSignOut} disabled={busy}>Sign Out</button>
          </div>
        )}

        {(status.message || busy || !online) && (
          <p className={`auth-status ${!online ? 'error' : status.tone}`} role="status" aria-live="polite">
            {!online ? 'You are offline. Reconnect to use account features.' : busy ? 'Working...' : status.message}
          </p>
        )}
      </section>
    </div>
  )
}
